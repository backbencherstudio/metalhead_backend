import { JobCategory } from '../enums/job-category.enum';
import { PaymentType } from '../enums/payment-type.enum';
import { JobType } from '../enums/job-type.enum';

/**
 * Comprehensive enum mapping utility that handles all variations
 * from Flutter frontend and converts them to valid database enum values
 */
export class EnumMapper {
  
  /**
   * Maps any category string to valid JobCategory enum
   */
  static mapCategory(input: string): JobCategory {
    if (!input) return JobCategory.OTHER;
    
    const normalized = input.trim().toUpperCase();
    
    // Direct enum matches
    if (Object.values(JobCategory).includes(normalized as JobCategory)) {
      return normalized as JobCategory;
    }
    
    // Comprehensive mapping for all possible variations
    const categoryMap: Record<string, JobCategory> = {
      // CLEANING variations
      'CLEANING': JobCategory.CLEANING,
      'CLEANING SERVICES': JobCategory.CLEANING,
      'CLEANING SERVICE': JobCategory.CLEANING,
      'HOUSE CLEANING': JobCategory.CLEANING,
      'OFFICE CLEANING': JobCategory.CLEANING,
      'DEEP CLEANING': JobCategory.CLEANING,
      'CLEAN': JobCategory.CLEANING,
      'CLEANER': JobCategory.CLEANING,
      
      // PLUMBING variations
      'PLUMBING': JobCategory.PLUMBING,
      'PLUMBER': JobCategory.PLUMBING,
      'PIPE REPAIR': JobCategory.PLUMBING,
      'DRAIN CLEANING': JobCategory.PLUMBING,
      'WATER HEATER': JobCategory.PLUMBING,
      'PLUMB': JobCategory.PLUMBING,
      
      // ELECTRICAL variations
      'ELECTRICAL': JobCategory.ELECTRICAL,
      'ELECTRICAL WORK': JobCategory.ELECTRICAL,
      'ELECTRICIAN': JobCategory.ELECTRICAL,
      'WIRING': JobCategory.ELECTRICAL,
      'OUTLET': JobCategory.ELECTRICAL,
      'ELECTRIC': JobCategory.ELECTRICAL,
      
      // HANDYMAN variations
      'HANDYMAN': JobCategory.HANDYMAN,
      'HANDYMAN SERVICES': JobCategory.HANDYMAN,
      'HANDYMAN SERVICE': JobCategory.HANDYMAN,
      'GENERAL REPAIR': JobCategory.HANDYMAN,
      'MAINTENANCE': JobCategory.HANDYMAN,
      'REPAIR': JobCategory.HANDYMAN,
      'FIX': JobCategory.HANDYMAN,
      
      // PAINTING variations
      'PAINTING': JobCategory.PAINTING,
      'PAINTER': JobCategory.PAINTING,
      'PAINT': JobCategory.PAINTING,
      'INTERIOR PAINTING': JobCategory.PAINTING,
      'EXTERIOR PAINTING': JobCategory.PAINTING,
      
      // GARDENING variations
      'GARDENING': JobCategory.GARDENING,
      'GARDENING & LAWN CARE': JobCategory.GARDENING,
      'GARDENING & LAWN': JobCategory.GARDENING,
      'LAWN CARE': JobCategory.GARDENING,
      'LAWN': JobCategory.GARDENING,
      'GARDEN': JobCategory.GARDENING,
      'LANDSCAPING': JobCategory.LANDSCAPING,
      'TREE TRIMMING': JobCategory.GARDENING,
      
      // MOVING variations
      'MOVING': JobCategory.MOVING,
      'MOVING & RELOCATION': JobCategory.MOVING,
      'MOVING SERVICES': JobCategory.MOVING,
      'MOVING SERVICE': JobCategory.MOVING,
      'RELOCATION': JobCategory.MOVING,
      'MOVE': JobCategory.MOVING,
      'PACKING': JobCategory.MOVING,
      
      // DELIVERY variations
      'DELIVERY': JobCategory.DELIVERY,
      'DELIVERY SERVICES': JobCategory.DELIVERY,
      'DELIVERY SERVICE': JobCategory.DELIVERY,
      'PACKAGE DELIVERY': JobCategory.DELIVERY,
      'GROCERY DELIVERY': JobCategory.DELIVERY,
      'DELIVER': JobCategory.DELIVERY,
      
      // PET CARE variations
      'PET CARE': JobCategory.PET_CARE,
      'PET_CARE': JobCategory.PET_CARE,
      'PET SITTING': JobCategory.PET_CARE,
      'DOG WALKING': JobCategory.PET_CARE,
      'PET GROOMING': JobCategory.PET_CARE,
      'PET': JobCategory.PET_CARE,
      'ANIMAL CARE': JobCategory.PET_CARE,
      
      // TUTORING variations
      'TUTORING': JobCategory.TUTORING,
      'TUTORING & EDUCATION': JobCategory.TUTORING,
      'TUTOR': JobCategory.TUTORING,
      'EDUCATION': JobCategory.TUTORING,
      'TEACHING': JobCategory.TUTORING,
      'LESSON': JobCategory.TUTORING,
      'ACADEMIC': JobCategory.TUTORING,
      
      // TECHNOLOGY variations
      'TECHNOLOGY': JobCategory.TECHNOLOGY,
      'TECHNOLOGY & IT': JobCategory.TECHNOLOGY,
      'IT': JobCategory.TECHNOLOGY,
      'COMPUTER REPAIR': JobCategory.TECHNOLOGY,
      'TECH SUPPORT': JobCategory.TECHNOLOGY,
      'SOFTWARE': JobCategory.TECHNOLOGY,
      'TECH': JobCategory.TECHNOLOGY,
      'COMPUTER': JobCategory.TECHNOLOGY,
      
      // PHOTOGRAPHY variations
      'PHOTOGRAPHY': JobCategory.PHOTOGRAPHY,
      'PHOTOGRAPHER': JobCategory.PHOTOGRAPHY,
      'PHOTO': JobCategory.PHOTOGRAPHY,
      'EVENT PHOTOGRAPHY': JobCategory.PHOTOGRAPHY,
      'PORTRAIT': JobCategory.PHOTOGRAPHY,
      'VIDEO': JobCategory.PHOTOGRAPHY,
      
      // EVENT PLANNING variations
      'EVENT PLANNING': JobCategory.EVENT_PLANNING,
      'EVENT_PLANNING': JobCategory.EVENT_PLANNING,
      'EVENT PLANNER': JobCategory.EVENT_PLANNING,
      'PARTY PLANNING': JobCategory.EVENT_PLANNING,
      'WEDDING PLANNING': JobCategory.EVENT_PLANNING,
      'EVENT': JobCategory.EVENT_PLANNING,
      'PLANNING': JobCategory.EVENT_PLANNING,
      
      // BEAUTY & WELLNESS variations
      'BEAUTY & WELLNESS': JobCategory.BEAUTY_WELLNESS,
      'BEAUTY_WELLNESS': JobCategory.BEAUTY_WELLNESS,
      'BEAUTY': JobCategory.BEAUTY_WELLNESS,
      'WELLNESS': JobCategory.BEAUTY_WELLNESS,
      'HAIR STYLING': JobCategory.BEAUTY_WELLNESS,
      'MAKEUP': JobCategory.BEAUTY_WELLNESS,
      'MASSAGE': JobCategory.BEAUTY_WELLNESS,
      'SALON': JobCategory.BEAUTY_WELLNESS,
      
      // FITNESS & TRAINING variations
      'FITNESS & TRAINING': JobCategory.FITNESS_TRAINING,
      'FITNESS_TRAINING': JobCategory.FITNESS_TRAINING,
      'FITNESS': JobCategory.FITNESS_TRAINING,
      'TRAINING': JobCategory.FITNESS_TRAINING,
      'PERSONAL TRAINING': JobCategory.FITNESS_TRAINING,
      'FITNESS COACHING': JobCategory.FITNESS_TRAINING,
      'YOGA': JobCategory.FITNESS_TRAINING,
      'GYM': JobCategory.FITNESS_TRAINING,
      
      // HOME SECURITY variations
      'HOME SECURITY': JobCategory.HOME_SECURITY,
      'HOME_SECURITY': JobCategory.HOME_SECURITY,
      'SECURITY': JobCategory.HOME_SECURITY,
      'SECURITY SYSTEM': JobCategory.HOME_SECURITY,
      'MONITORING': JobCategory.HOME_SECURITY,
      'SAFETY': JobCategory.HOME_SECURITY,
      
      // CARPENTRY variations
      'CARPENTRY': JobCategory.CARPENTRY,
      'CARPENTER': JobCategory.CARPENTRY,
      'WOODWORKING': JobCategory.CARPENTRY,
      'FURNITURE': JobCategory.CARPENTRY,
      'CUSTOM FURNITURE': JobCategory.CARPENTRY,
      'WOOD': JobCategory.CARPENTRY,
      
      // ROOFING variations
      'ROOFING': JobCategory.ROOFING,
      'ROOFER': JobCategory.ROOFING,
      'ROOF': JobCategory.ROOFING,
      'ROOF REPAIR': JobCategory.ROOFING,
      'GUTTER': JobCategory.ROOFING,
      
      // HVAC variations
      'HVAC': JobCategory.HVAC,
      'HVAC & HEATING/COOLING': JobCategory.HVAC,
      'HEATING': JobCategory.HVAC,
      'COOLING': JobCategory.HVAC,
      'AIR CONDITIONING': JobCategory.HVAC,
      'HEATING & COOLING': JobCategory.HVAC,
      'DUCT CLEANING': JobCategory.HVAC,
      'VENTILATION': JobCategory.HVAC,
      
      // LANDSCAPING variations
      'LANDSCAPER': JobCategory.LANDSCAPING,
      'GARDEN DESIGN': JobCategory.LANDSCAPING,
      'HARDSCAPING': JobCategory.LANDSCAPING,
      'IRRIGATION': JobCategory.LANDSCAPING,
      'OUTDOOR': JobCategory.LANDSCAPING,
      
      // OTHER variations
      'OTHER': JobCategory.OTHER,
      'MISC': JobCategory.OTHER,
      'MISCELLANEOUS': JobCategory.OTHER,
      'GENERAL': JobCategory.OTHER,
      'VARIOUS': JobCategory.OTHER,
    };
    
    return categoryMap[normalized] || JobCategory.OTHER;
  }
  
  /**
   * Maps any payment type string to valid PaymentType enum
   */
  static mapPaymentType(input: string): PaymentType {
    if (!input) return PaymentType.FIXED;
    
    const normalized = input.trim().toUpperCase();
    
    // Direct enum matches
    if (Object.values(PaymentType).includes(normalized as PaymentType)) {
      return normalized as PaymentType;
    }
    
    // Comprehensive mapping for payment types
    const paymentTypeMap: Record<string, PaymentType> = {
      'FIXED': PaymentType.FIXED,
      'FIXED PRICE': PaymentType.FIXED,
      'FIXED RATE': PaymentType.FIXED,
      'FIXED AMOUNT': PaymentType.FIXED,
      'ONE TIME': PaymentType.FIXED,
      'ONETIME': PaymentType.FIXED,
      'FLAT RATE': PaymentType.FIXED,
      'FLAT': PaymentType.FIXED,
      'TOTAL': PaymentType.FIXED,
      'FINAL': PaymentType.FIXED,
      
      'HOURLY': PaymentType.HOURLY,
      'HOURLY RATE': PaymentType.HOURLY,
      'PER HOUR': PaymentType.HOURLY,
      'HOUR': PaymentType.HOURLY,
      'HOURS': PaymentType.HOURLY,
      'TIME': PaymentType.HOURLY,
      'RATE': PaymentType.HOURLY,
    };
    
    return paymentTypeMap[normalized] || PaymentType.FIXED;
  }
  
  /**
   * Maps any job type string to valid JobType enum
   */
  static mapJobType(input: string): JobType {
    if (!input) return JobType.ANYTIME;
    
    const normalized = input.trim().toUpperCase();
    
    // Direct enum matches
    if (Object.values(JobType).includes(normalized as JobType)) {
      return normalized as JobType;
    }
    
    // Comprehensive mapping for job types
    const jobTypeMap: Record<string, JobType> = {
      'URGENT': JobType.URGENT,
      'URGENTLY': JobType.URGENT,
      'ASAP': JobType.URGENT,
      'AS SOON AS POSSIBLE': JobType.URGENT,
      'IMMEDIATE': JobType.URGENT,
      'EMERGENCY': JobType.URGENT,
      'RUSH': JobType.URGENT,
      'PRIORITY': JobType.URGENT,
      'QUICK': JobType.URGENT,
      'FAST': JobType.URGENT,
      
      'ANYTIME': JobType.ANYTIME,
      'ANY TIME': JobType.ANYTIME,
      'FLEXIBLE': JobType.ANYTIME,
      'NORMAL': JobType.ANYTIME,
      'REGULAR': JobType.ANYTIME,
      'STANDARD': JobType.ANYTIME,
      'SCHEDULED': JobType.ANYTIME,
      'PLANNED': JobType.ANYTIME,
      'ROUTINE': JobType.ANYTIME,
      'GENERAL': JobType.ANYTIME,
    };
    
    return jobTypeMap[normalized] || JobType.ANYTIME;
  }
}

