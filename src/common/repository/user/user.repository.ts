import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { PrismaClient } from '@prisma/client';
import appConfig from '../../../config/app.config';
import { ArrayHelper } from '../../helper/array.helper';
import { Role } from '../../guard/role/role.enum';
import { StripePayment } from 'src/common/lib/Payment/stripe/StripePayment';

const prisma = new PrismaClient();

export class UserRepository {
  /**
   * get user by email
   * @param email
   * @returns
   */
  static async getUserByEmail(email: string) {
    const user = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    return user;
  }

  // email varification
  static async verifyEmail({ email }) {
    const user = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    return user;
  }

  /**
   * get user details
   * @returns
   */
  static async getUserDetails(userId: string) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
      },
      include: {
        role_users: {
          include: {
            role: {
              include: {
                permission_roles: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return user;
  }

  /**
   * Check existance
   * @returns
   */
  static async exist({ field, value }) {
    const model = await prisma.user.findFirst({
      where: {
        [field]: value,
      },
    });
    return model;
  }

  /**
   * Create su admin user
   * @param param0
   * @returns
   */
  static async createSuAdminUser({ username, email, password }) {
    try {
      password = await bcrypt.hash(password, appConfig().security.salt);

      const user = await prisma.user.create({
        data: {
          username: username,
          email: email,
          password: password,
          type: 'su_admin',
        },
      });
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Invite user under tenant
   * @param param0
   * @returns
   */
  static async inviteUser({
    name,
    username,
    email,
    role_id,
  }: {
    name: string;
    username: string;
    email: string;
    role_id: string;
  }) {
    try {
      const user = await prisma.user.create({
        data: {
          name: name,
          username: username,
          email: email,
        },
      });
      if (user) {
        // attach role
        await this.attachRole({
          user_id: user.id,
          role_id: role_id,
        });
        return user;
      } else {
        return false;
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Attach a role to a user
   * @param param0
   * @returns
   */
  static async attachRole({
    user_id,
    role_id,
  }: {
    user_id: string;
    role_id: string;
  }) {
    const role = await prisma.roleUser.create({
      data: {
        user_id: user_id,
        role_id: role_id,
      },
    });
    return role;
  }

  /**
   * update user role
   * @param param0
   * @returns
   */
  static async syncRole({
    user_id,
    role_id,
  }: {
    user_id: string;
    role_id: string;
  }) {
    const role = await prisma.roleUser.updateMany({
      where: {
        AND: [
          {
            user_id: user_id,
          },
        ],
      },
      data: {
        role_id: role_id,
      },
    });
    return role;
  }

  /**
   * create user under a tenant
   * @param param0
   * @returns
   */
  static async createUser({
    username,
    first_name,
    last_name,
    email,
    password,
    phone_number,
    role_id = null,
    type = 'user',
  }: {
    username?: string;
    first_name?: string;
    last_name?: string;
    email: string;
    password: string;
    phone_number?: number;
    role_id?: string;
    type?: string;
  }) {
    try {
      const data = {};
      if (username) {
        data['username'] = username;
      }
      if (first_name) {
        data['first_name'] = first_name;
      }
      if (last_name) {
        data['last_name'] = last_name;
      }
      if (phone_number) {
        data['phone_number'] = phone_number;
      }
      if (email) {
        // Check if email already exist
        const userEmailExist = await UserRepository.exist({
          field: 'email',
          value: String(email),
        });

        if (userEmailExist) {
          return {
            success: false,
            message: 'Email already exist',
          };
        }

        data['email'] = email;
      }
      if (password) {
        data['password'] = await bcrypt.hash(
          password,
          appConfig().security.salt,
        );
      }

      if (type && ArrayHelper.inArray(type, Object.values(Role))) {
        data['type'] = type;

        // if (type == Role.VENDOR) {
        //   data['approved_at'] = DateHelper.now();
        // }
      }

      const user = await prisma.user.create({
        data: {
          ...data,
        },
      });

      if (user) {
        if (role_id) {
          // attach role
          await this.attachRole({
            user_id: user.id,
            role_id: role_id,
          });
        }

        return {
          success: true,
          message: 'User created successfully',
          data: user,
        };
      } else {
        return {
          success: false,
          message: 'User creation failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * create user under a tenant
   * @param param0
   * @returns
   */
  static async updateUser(
    user_id: string,
    {
      name,
      email,
      password,
      role_id = null,
      type = 'user',
    }: {
      name?: string;
      email?: string;
      password?: string;
      role_id?: string;
      type?: string;
    },
  ) {
    try {
      const data = {};
      if (name) {
        data['name'] = name;
      }
      if (email) {
        // Check if email already exist
        const userEmailExist = await UserRepository.exist({
          field: 'email',
          value: String(email),
        });

        if (userEmailExist) {
          return {
            success: false,
            message: 'Email already exist',
          };
        }
        data['email'] = email;
      }
      if (password) {
        data['password'] = await bcrypt.hash(
          password,
          appConfig().security.salt,
        );
      }

      if (ArrayHelper.inArray(type, Object.values(Role))) {
        data['type'] = type;
      } else {
        return {
          success: false,
          message: 'Invalid user type',
        };
      }

      const existUser = await prisma.user.findFirst({
        where: {
          id: user_id,
        },
      });

      if (!existUser) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const user = await prisma.user.update({
        where: {
          id: user_id,
        },
        data: {
          ...data,
        },
      });

      if (user) {
        if (role_id) {
          // attach role
          await this.attachRole({
            user_id: user.id,
            role_id: role_id,
          });
        }

        return {
          success: true,
          message: 'User updated successfully',
          data: user,
        };
      } else {
        return {
          success: false,
          message: 'User update failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * delete user
   * @param param0
   * @returns
   */
  static async deleteUser(user_id: string) {
    try {
      // check if user exist
      const existUser = await prisma.user.findFirst({
        where: {
          id: user_id,
        },
      });
      if (!existUser) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      await prisma.user.delete({
        where: {
          id: user_id,
        },
      });
      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // change password
  static async changePassword({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) {
    try {
      password = await bcrypt.hash(password, appConfig().security.salt);
      const user = await prisma.user.update({
        where: {
          email: email,
        },
        data: {
          password: password,
        },
      });
      return user;
    } catch (error) {
      throw error;
    }
  }

  // change email
  static async changeEmail({
    user_id,
    new_email,
  }: {
    user_id: string;
    new_email: string;
  }) {
    try {
      const user = await prisma.user.update({
        where: {
          id: user_id,
        },
        data: {
          email: new_email,
        },
      });
      return user;
    } catch (error) {
      throw error;
    }
  }

  // validate password
  static async validatePassword({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) {
    const user = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    if (user) {
      const isValid = await bcrypt.compare(password, user.password);
      return isValid;
    } else {
      return false;
    }
  }

  // convert user type between user and helper
  static async convertTo(user_id: string, type: string = 'user') {
    try {
      const userDetails = await UserRepository.getUserDetails(user_id);
      if (!userDetails) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      
      // Validate that the target type is either 'user' or 'helper'
      if (type !== 'user' && type !== 'helper') {
        return {
          success: false,
          message: 'Invalid type. Only "user" and "helper" are allowed',
        };
      }
      
      // Check if user is already the target type
      if (userDetails.type === type) {
        return {
          success: false,
          message: `User is already a ${type}`,
        };
      }
      
      // Only allow conversion between 'user' and 'helper'
      if (userDetails.type !== 'user' && userDetails.type !== 'helper') {
        return {
          success: false,
          message: 'User must be either "user" or "helper" to convert',
        };
      }
      
      // Update user type
      await prisma.user.update({
        where: { id: user_id },
        data: { type: type },
      });
  
      // ✅ Create Stripe Connect account if converting to helper
      if (type === 'helper') {
        const stripeResult = await UserRepository.createStripeConnectAccount(user_id);
        
        if (stripeResult.success) {
          console.log(`Stripe Connect account created for user ${user_id}: ${stripeResult.account_id}`);
        } else {
          console.error(`Failed to create Stripe Connect account for user ${user_id}: ${stripeResult.message}`);
          // Note: We don't fail the role conversion if Stripe fails
        }
      }
  
      return {
        success: true,
        message: `Converted to ${type} successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  // generate two factor secret
  static async generate2FASecret(user_id: string) {
    const user = await prisma.user.findFirst({
      where: { id: user_id },
    });

    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    const secret = speakeasy.generateSecret();
    await prisma.user.update({
      where: { id: user_id },
      data: { two_factor_secret: secret.base32 },
    });

    const otpAuthUrl = secret.otpauth_url;

    const qrCode = await QRCode.toDataURL(otpAuthUrl);

    return {
      success: true,
      message: '2FA secret generated successfully',
      data: {
        secret: secret.base32,
        qrCode: qrCode,
      },
    };
  }

  // verify two factor
  static async verify2FA(user_id: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: user_id } });

    if (!user || !user.two_factor_secret) return false;

    const isValid = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
    });

    return isValid;
  }

  // enable two factor
  static async enable2FA(user_id: string) {
    const user = await prisma.user.update({
      where: { id: user_id },
      data: { is_two_factor_enabled: 1 },
    });
    return user;
  }

  // disable two factor
  static async disable2FA(user_id: string) {
    const user = await prisma.user.update({
      where: { id: user_id },
      data: { is_two_factor_enabled: 0, two_factor_secret: null },
    });
    return user;
  }


static async changeUsername({
  user_id,
  new_username,
}: {
  user_id: string;
  new_username: string;
}) {
  try {
    // Check if the new username is already taken
    const existingUser = await prisma.user.findFirst({
      where: {
        username: new_username,
      },
    });

    if (existingUser) {
      return {
        success: false,
        message: 'Username is already in use by another account',
      };
    }

    // Update the username
    const user = await prisma.user.update({
      where: {
        id: user_id,
      },
      data: {
        username: new_username, 
      },
    });

    return {
      success: true,
      message: 'Username updated successfully',
      data: user,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}
 
static async createStripeConnectAccount(user_id: string) {
  try {
    // Check if user already has a Connect account
    const user = await prisma.user.findUnique({
      where: { id: user_id },
      select: { 
        id: true, 
        email: true, 
        name: true, 
        username: true,
        stripe_account_id: true 
      },
    });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    if (user.stripe_account_id) {
      return { success: false, message: 'User already has a Stripe Connect account' };
    }

    // Use existing method
    const stripeAccount = await StripePayment.createConnectedAccount(user.email);

    // Update user with Connect account ID
    await prisma.user.update({
      where: { id: user_id },
      data: {
        stripe_account_id: stripeAccount.id,
        stripe_account_status: 'pending',
      },
    });

    return {
      success: true,
      message: 'Stripe Connect account created successfully',
      account_id: stripeAccount.id,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

}
