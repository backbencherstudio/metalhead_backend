// external imports
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

//internal imports
import appConfig from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../common/repository/user/user.repository';
import { MailService } from '../../mail/mail.service';
import { UcodeRepository } from '../../common/repository/ucode/ucode.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { SojebStorage } from '../../common/lib/Disk/SojebStorage';
import { DateHelper } from '../../common/helper/date.helper';
import { StripePayment } from '../../common/lib/Payment/stripe/StripePayment';
import { StringHelper } from '../../common/helper/string.helper';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
    @InjectRedis() private readonly redis: Redis,
  ) { }

  async me(userId: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          avatar: true,
          phone_number: true,
          type: true,
          gender: true,
          address: true,
          state: true,
          city: true,
          zip_code: true,
          skills: true,
          bio: true,
          age: true,
          date_of_birth: true,
          created_at: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (user.avatar) {
        user['avatar_url'] = SojebStorage.url(
          appConfig().storageUrl.avatar + user.avatar,
        );
      }

      if (user) {
        return {
          success: true,
          data: user,
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
    image?: Express.Multer.File,
  ) {
    try {
      // Check if email is provided and reject it
      if (updateUserDto.email) {
        return {
          success: false,
          message: 'Email is not updateable through this endpoint. Please use the email change functionality if available.',
        };
      }

      const data: any = {};
      if (updateUserDto.first_name) {
        data.first_name = updateUserDto.first_name;
      }
      if (updateUserDto.username) {
        data.username = updateUserDto.username;
      }
      if (updateUserDto.last_name) {
        data.last_name = updateUserDto.last_name;
      }
      if (updateUserDto.phone_number) {
        data.phone_number = updateUserDto.phone_number;
      }
      if (updateUserDto.country) {
        data.country = updateUserDto.country;
      }
      if (updateUserDto.state) {
        data.state = updateUserDto.state;
      }
      if (updateUserDto.local_government) {
        data.local_government = updateUserDto.local_government;
      }
      if (updateUserDto.city) {
        data.city = updateUserDto.city;
      }
      if (updateUserDto.zip_code) {
        data.zip_code = updateUserDto.zip_code;
      }
      if (updateUserDto.address) {
        data.address = updateUserDto.address;
      }
      if (updateUserDto.gender) {
        data.gender = updateUserDto.gender;
      }
      if (updateUserDto.bio) {
        data.bio = updateUserDto.bio;
      }
      if (updateUserDto.age) {
        data.age = updateUserDto.age;
      }
      if (updateUserDto.skills) {
        // Skills is now an array of strings - Prisma will handle JSON conversion
        data.skills = updateUserDto.skills;
      }
      if (updateUserDto.date_of_birth) {
        data.date_of_birth = DateHelper.format(updateUserDto.date_of_birth);
      }
      if (image) {
        // delete old image from storage
        const oldImage = await this.prisma.user.findFirst({
          where: { id: userId },
          select: { avatar: true },
        });
        if (oldImage.avatar) {
          await SojebStorage.delete(
            appConfig().storageUrl.avatar + oldImage.avatar,
          );
        }

        // upload file
        const fileName = `${StringHelper.randomString()}${image.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.avatar + fileName,
          image.buffer,
        );

        data.avatar = fileName;
      }

      if (updateUserDto.username) {
        const usernameUpdateResponse = await UserRepository.changeUsername({
          user_id: userId,
          new_username: updateUserDto.username,
        });

        if (!usernameUpdateResponse.success) {
          return {
            success: false,
            message: usernameUpdateResponse.message,
          };
        }
      }


      const user = await UserRepository.getUserDetails(userId);
      if (user) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            ...data,
          },
        });

        return {
          success: true,
          message: 'User updated successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async validateUser(
    identifier: string,
    pass: string,
    token?: string,
  ): Promise<any> {
    const _password = pass;

    // Find user by email or username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier }
        ],
      },
    });

    if (user) {
      // Use bcrypt to compare password directly
      const bcrypt = await import('bcrypt');
      const _isValidPassword = await bcrypt.compare(_password, user.password);

      if (_isValidPassword) {
        const { password, ...result } = user;
        if (user.is_two_factor_enabled) {
          if (token) {
            const isValid = await UserRepository.verify2FA(user.id, token);
            if (!isValid) {
              throw new UnauthorizedException('Invalid token');
            }
          } else {
            throw new UnauthorizedException('Token is required');
          }
        }
        return result;
      } else {
        throw new UnauthorizedException('Password not matched');
      }
    } else {
      throw new UnauthorizedException('User not found');
    }
  }

  async login({ email, userId }) {
    try {
      const payload = { email: email, sub: userId };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

      const user = await UserRepository.getUserDetails(userId);

      // store refreshToken
      await this.redis.set(
        `refresh_token:${user.id}`,
        refreshToken,
        'EX',
        60 * 60 * 24 * 7, // 7 days in seconds
      );

      return {
        success: true,
        message: 'Logged in successfully',
        authorization: {
          type: 'bearer',
          access_token: accessToken,
          refresh_token: refreshToken,
        },
        type: user.type,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async refreshToken(user_id: string, refreshToken: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);

      if (!storedToken || storedToken != refreshToken) {
        return {
          success: false,
          message: 'Refresh token is required',
        };
      }

      if (!user_id) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const userDetails = await UserRepository.getUserDetails(user_id);
      if (!userDetails) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const payload = { email: userDetails.email, sub: userDetails.id };
      const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });

      return {
        success: true,
        authorization: {
          type: 'bearer',
          access_token: accessToken,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async revokeRefreshToken(user_id: string) {
    try {
      const storedToken = await this.redis.get(`refresh_token:${user_id}`);
      if (!storedToken) {
        return {
          success: false,
          message: 'Refresh token not found',
        };
      }

      await this.redis.del(`refresh_token:${user_id}`);

      return {
        success: true,
        message: 'Refresh token revoked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async register({
    username,
    first_name,
    last_name,
    email,
    password,
    type,
    phone_number,
  }: {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    phone_number: number;
    type: string;
  }) {
    try {
      // Check if email already exist
      const userEmailExist = await UserRepository.exist({
        field: 'email',
        value: String(email),
      });

      if (userEmailExist) {
        return {
          statusCode: 401,
          message: 'Email already exist',
        };
      }

      const user = await UserRepository.createUser({
        username: username,
        first_name: first_name,
        last_name: last_name,
        email: email,
        password: password,
        phone_number: phone_number,
        type: type,
      });

      if (user == null && user.success == false) {
        return {
          success: false,
          message: 'Failed to create account',
        };
      }

      // create stripe customer account
      const stripeCustomer = await StripePayment.createCustomer({
        user_id: user.data.id,
        email: email,
        name: username,
      });

      if (stripeCustomer) {
        await this.prisma.user.update({
          where: {
            id: user.data.id,
          },
          data: {
            billing_id: stripeCustomer.id,
          },
        });
      }

      // Create Stripe Connect account for helpers
      if (type === 'helper') {
        try {
          const stripeResult = await UserRepository.createStripeConnectAccount(user.data.id);
          if (stripeResult.success) {
            console.log(`Stripe Connect account created for helper ${user.data.id}: ${stripeResult.account_id}`);
          } else {
            console.error(`Failed to create Stripe Connect account for helper ${user.data.id}: ${stripeResult.message}`);
          }
        } catch (error) {
          console.error('Error creating Stripe Connect account for helper:', error.message);
        }
      }

      // ----------------------------------------------------
      // create otp code
      const token = await UcodeRepository.createToken({
        userId: user.data.id,
        isOtp: true,
      });

      // send otp code to email
      await this.mailService.sendOtpCodeToEmail({
        email: email,
        name: username,
        otp: token,
      });

      return {
        success: true,
        message: 'We have sent an OTP code to your email',
      };

      // ----------------------------------------------------

      // Generate verification token
      // const token = await UcodeRepository.createVerificationToken({
      //   userId: user.data.id,
      //   email: email,
      // });

      // // Send verification email with token
      // await this.mailService.sendVerificationLink({
      //   email,
      //   name: email,
      //   token: token.token,
      //   type: type,
      // });

      // return {
      //   success: true,
      //   message: 'We have sent a verification link to your email',
      // };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async forgotPassword(email) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: user.name,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async resetPassword({ email, token, password }) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await UserRepository.changePassword({
            email: email,
            password: password,
          });

          // delete otp code
          await UcodeRepository.deleteToken({
            email: email,
            token: token,
          });

          return {
            success: true,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async verifyEmail({ email, token }) {
    try {
      const user = await UserRepository.exist({
        field: 'email',
        value: email,
      });

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: email,
          token: token,
        });

        if (existToken) {
          await this.prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              email_verified_at: new Date(Date.now()),
            },
          });

          // delete otp code
          await UcodeRepository.deleteToken({
            email: email,
            token: token,
          });

          return {
            success: true,
            message: 'Email verified successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async resendVerificationEmail(email: string) {
    try {
      const user = await UserRepository.getUserByEmail(email);

      if (user) {
        // create otp code
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
        });

        // send otp code to email
        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: user.name,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent a verification code to your email',
        };
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async changePassword({ user_id, oldPassword, newPassword }) {
    try {
      const user = await UserRepository.getUserDetails(user_id);

      if (user) {
        const _isValidPassword = await UserRepository.validatePassword({
          email: user.email,
          password: oldPassword,
        });
        if (_isValidPassword) {
          await UserRepository.changePassword({
            email: user.email,
            password: newPassword,
          });

          return {
            success: true,
            message: 'Password updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid password',
          };
        }
      } else {
        return {
          success: false,
          message: 'Email not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async requestEmailChange(user_id: string, email: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        const token = await UcodeRepository.createToken({
          userId: user.id,
          isOtp: true,
          email: email,
        });

        await this.mailService.sendOtpCodeToEmail({
          email: email,
          name: email,
          otp: token,
        });

        return {
          success: true,
          message: 'We have sent an OTP code to your email',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  //   async requestUsernameChange(user_id: string, email: string) {
  //   try {
  //     const user = await UserRepository.getUserByEmail(email);
  //     if (!user) {
  //       return {
  //         success: false,
  //         message: 'User with this email address does not exist', 
  //       };
  //     }
  //     const token = await UcodeRepository.createToken({
  //       userId: user_id,
  //       isOtp: true,
  //       email: email, 
  //     });

  //     await this.mailService.sendOtpCodeToEmail({
  //       email: email,
  //       name: user.username, 
  //       otp: token,
  //     });

  //     return {
  //       success: true,
  //       message: 'We have sent an OTP code to your email for username change', 
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message, 
  //     };
  //   }
  // }


  async changeEmail({
    user_id,
    new_email,
    token,
  }: {
    user_id: string;
    new_email: string;
    token: string;
  }) {
    try {
      const user = await UserRepository.getUserDetails(user_id);

      if (user) {
        const existToken = await UcodeRepository.validateToken({
          email: new_email,
          token: token,
          forEmailChange: true,
        });

        if (existToken) {
          await UserRepository.changeEmail({
            user_id: user.id,
            new_email: new_email,
          });

          // delete otp code
          await UcodeRepository.deleteToken({
            email: new_email,
            token: token,
          });

          return {
            success: true,
            message: 'Email updated successfully',
          };
        } else {
          return {
            success: false,
            message: 'Invalid token',
          };
        }
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }



  async changeUsername({
    user_id,
    new_email,
    token,
    new_username,
  }: {
    user_id: string;
    new_email: string;
    token: string;
    new_username: string;
  }) {
    try {
      const user = await UserRepository.getUserDetails(user_id);

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Validate the token for email change
      const existToken = await UcodeRepository.validateToken({
        email: new_email,
        token,
        forEmailChange: true,
      });

      if (!existToken) {
        return {
          success: false,
          message: 'Invalid token',
        };
      }

      // Proceed with updating both email and username
      const updatedUser = await this.prisma.user.update({
        where: { id: user_id },
        data: {
          username: new_username, // Update username
        },
      });

      return {
        success: true,
        message: 'username updated successfully',
        data: updatedUser,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Something went wrong',
      };
    }
  }

  // --------- 2FA ---------
  async generate2FASecret(user_id: string) {
    try {
      return await UserRepository.generate2FASecret(user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async verify2FA(user_id: string, token: string) {
    try {
      const isValid = await UserRepository.verify2FA(user_id, token);
      if (!isValid) {
        return {
          success: false,
          message: 'Invalid token',
        };
      }
      return {
        success: true,
        message: '2FA verified successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async enable2FA(user_id: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        await UserRepository.enable2FA(user_id);
        return {
          success: true,
          message: '2FA enabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async disable2FA(user_id: string) {
    try {
      const user = await UserRepository.getUserDetails(user_id);
      if (user) {
        await UserRepository.disable2FA(user_id);
        return {
          success: true,
          message: '2FA disabled successfully',
        };
      } else {
        return {
          success: false,
          message: 'User not found',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
  // --------- end 2FA ---------

  async convertUserType(userId: string, type: string) {
    try {
      const result = await UserRepository.convertTo(userId, type);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Helper Onboarding Methods
  async getHelperOnboardingLink(user_id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { 
          stripe_account_id: true, 
          stripe_onboarding_completed: true,
          email: true 
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (!user.stripe_account_id) {
        return {
          success: false,
          message: 'Stripe Connect account not found. Please convert to helper role first.',
        };
      }

      if (user.stripe_onboarding_completed) {
        return {
          success: false,
          message: 'Onboarding already completed',
        };
      }

      // Generate onboarding link using existing StripePayment method
      const accountLink = await StripePayment.createOnboardingAccountLink(user.stripe_account_id);

      return {
        success: true,
        url: accountLink.url,
        message: 'Onboarding link generated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to generate onboarding link',
      };
    }
  }

  async checkHelperOnboardingStatus(user_id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { 
          stripe_account_id: true, 
          stripe_onboarding_completed: true 
        },
      });

      if (!user?.stripe_account_id) {
        return {
          success: false,
          message: 'Stripe account not found',
        };
      }

      // Check account status with Stripe
      const account = await StripePayment.checkAccountStatus(user.stripe_account_id);
      
      const isOnboardCompleted = account.details_submitted && account.charges_enabled;

      // Update user onboarding status if completed
      if (isOnboardCompleted && !user.stripe_onboarding_completed) {
        await this.prisma.user.update({
          where: { id: user_id },
          data: { 
            stripe_onboarding_completed: true,
            stripe_account_status: 'active',
          },
        });
      }

      return {
        success: true,
        isOnboarded: isOnboardCompleted,
        accountId: user.stripe_account_id,
        message: 'Onboarding status checked successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to check onboarding status',
      };
    }
  }

  async getHelperPaymentStatus(user_id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: {
          stripe_account_id: true,
          stripe_onboarding_completed: true,
          stripe_account_status: true,
          stripe_payouts_enabled: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const hasStripeAccount = !!user.stripe_account_id;
      const isOnboarded = user.stripe_onboarding_completed || false;
      const accountStatus = user.stripe_account_status || 'none';
      const canReceivePayments = isOnboarded && user.stripe_payouts_enabled;

      return {
        success: true,
        data: {
          hasStripeAccount,
          isOnboarded,
          accountStatus,
          canReceivePayments,
        },
        message: 'Payment status retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to get payment status',
      };
    }
  }

}
