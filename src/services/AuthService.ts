import { DatabaseContext } from '../database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { User, AuthToken } from '../models/types';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class AuthService {
  constructor(private dbContext: DatabaseContext) {}

  /**
   * Register a new user
   */
  async register(input: {
    email: string;
    password: string;
    name: string;
    role: string;
  }): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = this.dbContext.users.findByEmail(input.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(input.password, 10);

      // Create user
      const user = this.dbContext.users.create({
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role as any,
      });

      logger.info('User registered', { userId: user.id, email: user.email, role: user.role });

      return user;
    } catch (error) {
      logger.error('User registration failed', { email: input.email, error });
      throw error;
    }
  }

  /**
   * Login user and generate JWT token
   */
  async login(email: string, password: string): Promise<AuthToken> {
    try {
      // Find user
      const user = this.dbContext.users.findByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
        },
        config.jwtSecret as string,
        { expiresIn: '24h' }
      );

      logger.info('User logged in', { userId: user.id, email: user.email });

      // Return token and user info (without password hash)
      const { passwordHash, ...userWithoutPassword } = user;

      return {
        token,
        user: userWithoutPassword,
      };
    } catch (error) {
      logger.error('Login failed', { email, error });
      throw error;
    }
  }

  /**
   * Verify JWT token and return user
   */
  verifyToken(token: string): { userId: string; email: string; role: string } {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   */
  getUserById(userId: string): Omit<User, 'passwordHash'> | null {
    try {
      const user = this.dbContext.users.findById(userId);
      if (!user) {
        return null;
      }

      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      logger.error('Failed to get user by ID', { userId, error });
      return null;
    }
  }
}
