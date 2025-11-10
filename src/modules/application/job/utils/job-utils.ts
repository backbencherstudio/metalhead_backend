import { SojebStorage } from '../../../../common/lib/Disk/SojebStorage';

export const parsePhotos = (photosJson: string): string[] => {
  try {
    const photos = JSON.parse(photosJson);
    if (Array.isArray(photos)) {
      return photos.map((photo) => SojebStorage.url(photo));
    }
    return [SojebStorage.url(photos)];
  } catch (error) {
    return [SojebStorage.url(photosJson)];
  }
};

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateHours = (startTime: Date, endTime: Date): number => {
  const diffInMs = endTime.getTime() - startTime.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);
  return Math.round(diffInHours * 100) / 100;
};

export const formatEstimatedTime = (hours: number): string => {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (hours === 1) {
    return '1 hour';
  } else if (hours < 24) {
    return `${hours} hours`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else {
      return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
  }
};

const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

