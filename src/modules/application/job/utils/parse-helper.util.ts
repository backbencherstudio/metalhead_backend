export const parseJsonField = <T>(
  value: unknown,
  defaultValue: T,
  errorLabel: string,
): T => {
  if (!value) {
    return defaultValue;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error(`Failed to parse ${errorLabel}:`, error);
      return defaultValue;
    }
  }

  if (Array.isArray(value)) {
    return value as unknown as T;
  }

  return defaultValue;
};

import { BadRequestException } from '@nestjs/common';
import { SojebStorage } from '../../../../common/lib/Disk/SojebStorage';
import { v4 as uuidv4 } from 'uuid';
import { convertEnumToCategoryName } from './category-mapper.util';

export const collectPhotoPaths = async (
  files: Record<string, Express.Multer.File[]>,
): Promise<string[]> => {
  const photoPaths: string[] = [];
  const fileFields = ['files', 'photoes', 'photos'];

  for (const fieldName of fileFields) {
    if (files?.[fieldName] && files[fieldName].length > 0) {
      for (const file of files[fieldName]) {
        photoPaths.push(await saveFile(file));
      }
    }
  }

  const singleFile = files?.file?.[0] || files?.image?.[0] || files?.photo?.[0];
  if (singleFile) {
    photoPaths.push(await saveFile(singleFile));
  }

  return photoPaths;
};

export const normalizeCoordinates = (dto: any): { latitude?: number; longitude?: number } => {
  const latitudeInput =
    dto.latitude ??
    dto.lat ??
    dto?.Latitude ??
    dto?.LATITUDE;
  const longitudeInput =
    dto.longitude ??
    dto.lng ??
    dto.long ??
    dto.lon ??
    dto.longtitude ??
    dto?.Longitude ??
    dto?.LONGITUDE;

  if (latitudeInput === undefined || longitudeInput === undefined) {
    return { latitude: undefined, longitude: undefined };
  }

  const latitude = typeof latitudeInput === 'number' ? latitudeInput : parseFloat(String(latitudeInput));
  const longitude = typeof longitudeInput === 'number' ? longitudeInput : parseFloat(String(longitudeInput));

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new BadRequestException(
      `Latitude and longitude must be valid numbers. Received: lat="${latitudeInput}" (type: ${typeof latitudeInput}), lng="${longitudeInput}" (type: ${typeof longitudeInput})`,
    );
  }

  dto.latitude = latitude;
  dto.longitude = longitude;

  return { latitude, longitude };
};

export const normalizeEnum = (
  value: string,
  allowedValues: string[],
  fieldName: string,
): string => {
  if (typeof value === 'string') {
    const normalized = value.toUpperCase();
    if (!allowedValues.includes(normalized)) {
      throw new BadRequestException(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
    }
    return normalized;
  }
  return value;
};

export const normalizeCategory = (category: string) =>
  typeof category === 'string' ? convertEnumToCategoryName(category) : category;

const saveFile = async (file: Express.Multer.File): Promise<string> => {
  const fileExtension = file.originalname.split('.').pop();
  const uniqueFileName = `job-photos/${uuidv4()}.${fileExtension}`;
  await SojebStorage.put(uniqueFileName, file.buffer);
  return uniqueFileName;
};

