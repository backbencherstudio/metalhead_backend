import { JobCategory } from '@prisma/client';
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
      'HOUSE CLEANER': JobCategory.CLEANING,
      'MAID': JobCategory.CLEANING,
      'JANITORIAL': JobCategory.CLEANING,

      // PLUMBING variations
      'PLUMBING': JobCategory.PLUMBING,
      'PLUMBER': JobCategory.PLUMBING,
      'PIPE REPAIR': JobCategory.PLUMBING,
      'DRAIN CLEANING': JobCategory.PLUMBING,
      'WATER HEATER': JobCategory.PLUMBING,
      'PLUMB': JobCategory.PLUMBING,
      'PIPES': JobCategory.PLUMBING,
      'DRAIN': JobCategory.PLUMBING,
      'TOILET': JobCategory.PLUMBING,
      'FAUCET': JobCategory.PLUMBING,

      // ELECTRICAL variations
      'ELECTRICAL': JobCategory.ELECTRICAL,
      'ELECTRICAL WORK': JobCategory.ELECTRICAL,
      'ELECTRICIAN': JobCategory.ELECTRICAL,
      'WIRING': JobCategory.ELECTRICAL,
      'OUTLET': JobCategory.ELECTRICAL,
      'ELECTRIC': JobCategory.ELECTRICAL,
      'ELECTRICAL REPAIR': JobCategory.ELECTRICAL,
      'LIGHTING': JobCategory.ELECTRICAL,
      'CIRCUIT': JobCategory.ELECTRICAL,

      // HANDYMAN variations
      'HANDYMAN': JobCategory.HANDYMAN,
      'HANDYMAN SERVICES': JobCategory.HANDYMAN,
      'HANDYMAN SERVICE': JobCategory.HANDYMAN,
      'GENERAL REPAIR': JobCategory.HANDYMAN,
      'MAINTENANCE': JobCategory.HANDYMAN,
      'REPAIR': JobCategory.HANDYMAN,
      'FIX': JobCategory.HANDYMAN,
      'REPAIRS': JobCategory.HANDYMAN,
      'FIXES': JobCategory.HANDYMAN,
      'SMALL JOBS': JobCategory.HANDYMAN,

      // PAINTING variations
      'PAINTING': JobCategory.PAINTING,
      'PAINTER': JobCategory.PAINTING,
      'PAINT': JobCategory.PAINTING,
      'INTERIOR PAINTING': JobCategory.PAINTING,
      'EXTERIOR PAINTING': JobCategory.PAINTING,
      'WALL PAINTING': JobCategory.PAINTING,
      'COLOR': JobCategory.PAINTING,
      'BRUSH': JobCategory.PAINTING,

      // GARDENING variations
      'GARDENING': JobCategory.GARDENING,
      'GARDENING & LAWN CARE': JobCategory.GARDENING,
      'GARDENING & LAWN': JobCategory.GARDENING,
      'LAWN CARE': JobCategory.GARDENING,
      'LAWN': JobCategory.GARDENING,
      'GARDEN': JobCategory.GARDENING,
      'YARD WORK': JobCategory.GARDENING,
      'YARD': JobCategory.GARDENING,
      'OUTDOOR': JobCategory.GARDENING,
      'TREE TRIMMING': JobCategory.GARDENING,
      'GARDEN LANDSCAPING': JobCategory.GARDENING,

      // MOVING variations
      'MOVING': JobCategory.MOVING,
      'MOVING & RELOCATION': JobCategory.MOVING,
      'MOVING SERVICES': JobCategory.MOVING,
      'MOVING SERVICE': JobCategory.MOVING,
      'RELOCATION': JobCategory.MOVING,
      'MOVE': JobCategory.MOVING,
      'PACKING': JobCategory.MOVING,
      'FURNITURE MOVING': JobCategory.MOVING,
      'HEAVY LIFTING': JobCategory.MOVING,
      'LIFTING': JobCategory.MOVING,

      // DELIVERY variations
      'DELIVERY': JobCategory.DELIVERY,
      'DELIVERY SERVICES': JobCategory.DELIVERY,
      'DELIVERY SERVICE': JobCategory.DELIVERY,
      'PACKAGE DELIVERY': JobCategory.DELIVERY,
      'GROCERY DELIVERY': JobCategory.DELIVERY,
      'DOCUMENT DELIVERY': JobCategory.DELIVERY,
      'COURIER': JobCategory.DELIVERY,
      'DELIVER': JobCategory.DELIVERY,
      'PACKAGE': JobCategory.DELIVERY,
      'SHIPPING': JobCategory.DELIVERY,

      // PET_CARE variations
      'PET_CARE': JobCategory.PET_CARE,
      'PET CARE': JobCategory.PET_CARE,
      'PET SITTING': JobCategory.PET_CARE,
      'DOG WALKING': JobCategory.PET_CARE,
      'PET GROOMING': JobCategory.PET_CARE,
      'VETERINARY': JobCategory.PET_CARE,
      'PET': JobCategory.PET_CARE,
      'ANIMAL CARE': JobCategory.PET_CARE,
      'DOG SITTING': JobCategory.PET_CARE,
      'CAT SITTING': JobCategory.PET_CARE,
      'DOG CARE': JobCategory.PET_CARE,

      // TUTORING variations
      'TUTORING': JobCategory.TUTORING,
      'TUTORING & EDUCATION': JobCategory.TUTORING,
      'TUTOR': JobCategory.TUTORING,
      'EDUCATION': JobCategory.TUTORING,
      'TEACHING': JobCategory.TUTORING,
      'LESSON': JobCategory.TUTORING,
      'ACADEMIC': JobCategory.TUTORING,
      'SCHOOL': JobCategory.TUTORING,
      'LEARNING': JobCategory.TUTORING,
      'INSTRUCTION': JobCategory.TUTORING,

      // TECHNOLOGY variations
      'TECHNOLOGY': JobCategory.TECHNOLOGY,
      'TECHNOLOGY & IT': JobCategory.TECHNOLOGY,
      'IT': JobCategory.TECHNOLOGY,
      'COMPUTER REPAIR': JobCategory.TECHNOLOGY,
      'TECH SUPPORT': JobCategory.TECHNOLOGY,
      'SOFTWARE': JobCategory.TECHNOLOGY,
      'TECH': JobCategory.TECHNOLOGY,
      'COMPUTER': JobCategory.TECHNOLOGY,
      'DEVICE SETUP': JobCategory.TECHNOLOGY,
      'TECHNICAL': JobCategory.TECHNOLOGY,
      'DIGITAL': JobCategory.TECHNOLOGY,

      // PHOTOGRAPHY variations
      'PHOTOGRAPHY': JobCategory.PHOTOGRAPHY,
      'PHOTOGRAPHER': JobCategory.PHOTOGRAPHY,
      'PHOTO': JobCategory.PHOTOGRAPHY,
      'EVENT PHOTOGRAPHY': JobCategory.PHOTOGRAPHY,
      'PORTRAIT': JobCategory.PHOTOGRAPHY,
      'VIDEO': JobCategory.PHOTOGRAPHY,
      'CAMERA': JobCategory.PHOTOGRAPHY,
      'PHOTOS': JobCategory.PHOTOGRAPHY,
      'VIDEOGRAPHY': JobCategory.PHOTOGRAPHY,

      // EVENT_PLANNING variations
      'EVENT_PLANNING': JobCategory.EVENT_PLANNING,
      'EVENT PLANNING': JobCategory.EVENT_PLANNING,
      'EVENT PLANNER': JobCategory.EVENT_PLANNING,
      'PARTY PLANNING': JobCategory.EVENT_PLANNING,
      'WEDDING PLANNING': JobCategory.EVENT_PLANNING,
      'EVENT': JobCategory.EVENT_PLANNING,
      'PLANNING': JobCategory.EVENT_PLANNING,
      'PARTY': JobCategory.EVENT_PLANNING,
      'WEDDING': JobCategory.EVENT_PLANNING,
      'COORDINATION': JobCategory.EVENT_PLANNING,

      // BEAUTY_WELLNESS variations
      'BEAUTY_WELLNESS': JobCategory.BEAUTY_WELLNESS,
      'BEAUTY & WELLNESS': JobCategory.BEAUTY_WELLNESS,
      'BEAUTY': JobCategory.BEAUTY_WELLNESS,
      'WELLNESS': JobCategory.BEAUTY_WELLNESS,
      'HAIR STYLING': JobCategory.BEAUTY_WELLNESS,
      'MAKEUP': JobCategory.BEAUTY_WELLNESS,
      'MASSAGE': JobCategory.BEAUTY_WELLNESS,
      'SALON': JobCategory.BEAUTY_WELLNESS,
      'SPA': JobCategory.BEAUTY_WELLNESS,
      'COSMETIC': JobCategory.BEAUTY_WELLNESS,

      // FITNESS variations
      'FITNESS': JobCategory.FITNESS,
      'FITNESS & TRAINING': JobCategory.FITNESS,
      'FITNESS TRAINING': JobCategory.FITNESS,
      'PERSONAL TRAINING': JobCategory.FITNESS,
      'FITNESS COACHING': JobCategory.FITNESS,
      'YOGA': JobCategory.FITNESS,
      'GYM': JobCategory.FITNESS,
      'TRAINING': JobCategory.FITNESS,
      'EXERCISE': JobCategory.FITNESS,
      'WORKOUT': JobCategory.FITNESS,

      // SECURITY variations
      'SECURITY': JobCategory.SECURITY,
      'HOME SECURITY': JobCategory.SECURITY,
      'SECURITY SYSTEM': JobCategory.SECURITY,
      'MONITORING': JobCategory.SECURITY,
      'SAFETY': JobCategory.SECURITY,
      'ALARM': JobCategory.SECURITY,
      'SURVEILLANCE': JobCategory.SECURITY,
      'PROTECTION': JobCategory.SECURITY,

      // CARPENTRY variations
      'CARPENTRY': JobCategory.CARPENTRY,
      'CARPENTER': JobCategory.CARPENTRY,
      'WOODWORKING': JobCategory.CARPENTRY,
      'FURNITURE': JobCategory.CARPENTRY,
      'CUSTOM FURNITURE': JobCategory.CARPENTRY,
      'WOOD': JobCategory.CARPENTRY,
      'CABINET': JobCategory.CARPENTRY,
      'SHELF': JobCategory.CARPENTRY,

      // ROOFING variations
      'ROOFING': JobCategory.ROOFING,
      'ROOFER': JobCategory.ROOFING,
      'ROOF': JobCategory.ROOFING,
      'ROOF REPAIR': JobCategory.ROOFING,
      'GUTTER': JobCategory.ROOFING,
      'SHINGLE': JobCategory.ROOFING,
      'ROOF MAINTENANCE': JobCategory.ROOFING,

      // HVAC variations
      'HVAC': JobCategory.HVAC,
      'HVAC & HEATING/COOLING': JobCategory.HVAC,
      'HEATING': JobCategory.HVAC,
      'COOLING': JobCategory.HVAC,
      'AIR CONDITIONING': JobCategory.HVAC,
      'HEATING & COOLING': JobCategory.HVAC,
      'DUCT CLEANING': JobCategory.HVAC,
      'VENTILATION': JobCategory.HVAC,
      'FURNACE': JobCategory.HVAC,
      'AC': JobCategory.HVAC,

      // LANDSCAPING variations
      'LANDSCAPING': JobCategory.LANDSCAPING,
      'LANDSCAPER': JobCategory.LANDSCAPING,
      'GARDEN DESIGN': JobCategory.LANDSCAPING,
      'HARDSCAPING': JobCategory.LANDSCAPING,
      'IRRIGATION': JobCategory.LANDSCAPING,
      'OUTDOOR PROJECTS': JobCategory.LANDSCAPING,
      'PATIO': JobCategory.LANDSCAPING,
      'DECK': JobCategory.LANDSCAPING,

      // CAR_SERVICES variations
      'CAR_SERVICES': JobCategory.CAR_SERVICES,
      'CAR SERVICES': JobCategory.CAR_SERVICES,
      'CAR WASHING': JobCategory.CAR_SERVICES,
      'CAR MAINTENANCE': JobCategory.CAR_SERVICES,
      'AUTO': JobCategory.CAR_SERVICES,
      'VEHICLE': JobCategory.CAR_SERVICES,
      'CAR WASH': JobCategory.CAR_SERVICES,
      'AUTOMOTIVE': JobCategory.CAR_SERVICES,

      // HOUSE_SITTING variations
      'HOUSE_SITTING': JobCategory.HOUSE_SITTING,
      'HOUSE SITTING': JobCategory.HOUSE_SITTING,
      'HOUSE WATCHING': JobCategory.HOUSE_SITTING,
      'PROPERTY MONITORING': JobCategory.HOUSE_SITTING,
      'HOUSE': JobCategory.HOUSE_SITTING,
      'SITTING': JobCategory.HOUSE_SITTING,
      'WATCHING': JobCategory.HOUSE_SITTING,
      'HOUSE CARE': JobCategory.HOUSE_SITTING,

      // ERRANDS variations
      'ERRANDS': JobCategory.ERRANDS,
      'ERRANDS & SHOPPING': JobCategory.ERRANDS,
      'RUNNING ERRANDS': JobCategory.ERRANDS,
      'PERSONAL TASKS': JobCategory.ERRANDS,
      'SHOPPING': JobCategory.ERRANDS,
      'GROCERY SHOPPING': JobCategory.ERRANDS,
      'TASKS': JobCategory.ERRANDS,
      'PERSONAL ERRANDS': JobCategory.ERRANDS,

      // ASSEMBLY variations
      'ASSEMBLY': JobCategory.ASSEMBLY,
      'ASSEMBLY & INSTALLATION': JobCategory.ASSEMBLY,
      'FURNITURE ASSEMBLY': JobCategory.ASSEMBLY,
      'EQUIPMENT INSTALLATION': JobCategory.ASSEMBLY,
      'SETUP': JobCategory.ASSEMBLY,
      'INSTALL': JobCategory.ASSEMBLY,
      'ASSEMBLE': JobCategory.ASSEMBLY,
      'INSTALLATION': JobCategory.ASSEMBLY,

      // PERSONAL_CARE variations
      'PERSONAL_CARE': JobCategory.PERSONAL_CARE,
      'PERSONAL ASSISTANCE': JobCategory.PERSONAL_CARE,
      'PERSONAL HELP': JobCategory.PERSONAL_CARE,
      'COMPANIONSHIP': JobCategory.PERSONAL_CARE,
      'DAILY ASSISTANCE': JobCategory.PERSONAL_CARE,
      'ASSISTANCE': JobCategory.PERSONAL_CARE,
      'HELP': JobCategory.PERSONAL_CARE,
      'PERSONAL': JobCategory.PERSONAL_CARE,
      'CARE': JobCategory.PERSONAL_CARE,

      // TRANSPORTATION variations
      'TRANSPORTATION': JobCategory.TRANSPORTATION,
      'RIDE SERVICES': JobCategory.TRANSPORTATION,
      'AIRPORT PICKUP': JobCategory.TRANSPORTATION,
      'LOCAL TRANSPORTATION': JobCategory.TRANSPORTATION,
      'RIDE': JobCategory.TRANSPORTATION,
      'DRIVER': JobCategory.TRANSPORTATION,
      'TAXI': JobCategory.TRANSPORTATION,
      'UBER': JobCategory.TRANSPORTATION,
      'LYFT': JobCategory.TRANSPORTATION,

      // OTHER variations
      'OTHER': JobCategory.OTHER,
      'MISC': JobCategory.OTHER,
      'MISCELLANEOUS': JobCategory.OTHER,
      'GENERAL': JobCategory.OTHER,
      'VARIOUS': JobCategory.OTHER,
      'UNKNOWN': JobCategory.OTHER,
    };
    
    return categoryMap[normalized] || JobCategory.OTHER;
  }

  /**
   * Maps any payment type string to valid PaymentType enum
   */
  static mapPaymentType(input: string): PaymentType {
    if (!input) return PaymentType.FIXED;
    
    const normalized = input.trim().toUpperCase();
    
    if (normalized === 'HOURLY' || normalized === 'HOUR') {
      return PaymentType.HOURLY;
    }
    
    return PaymentType.FIXED;
  }

  /**
   * Maps any job type string to valid JobType enum
   */
  static mapJobType(input: string): JobType {
    if (!input) return JobType.ANYTIME;
    
    const normalized = input.trim().toUpperCase();
    
    if (normalized === 'URGENT' || normalized === 'URGENTLY') {
      return JobType.URGENT;
    }
    
    return JobType.ANYTIME;
  }
}