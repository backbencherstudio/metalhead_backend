import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  /**
   * Geocode an address to get latitude and longitude coordinates
   * Using OpenStreetMap Nominatim API (free, no API key required)
   * Tries multiple variations for better success rate
   */
  async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      if (!address || address.trim().length === 0) {
        this.logger.warn('Empty address provided for geocoding');
        return null;
      }

      // Try multiple variations of the address for better success rate
      const addressVariations = this.generateAddressVariations(address.trim());
      
      for (const variation of addressVariations) {
        const result = await this.tryGeocodeVariation(variation);
        if (result) {
          this.logger.log(`Successfully geocoded address: "${address}" -> (${result.lat}, ${result.lng}) using variation: "${variation}"`);
          return result;
        }
        
        // Small delay between attempts to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.logger.warn(`No results found for address: "${address}" after trying ${addressVariations.length} variations`);
      return null;
    } catch (error) {
      this.logger.error(`Geocoding failed for address: "${address}"`, error.message);
      return null;
    }
  }

  /**
   * Try to geocode a single address variation
   */
  private async tryGeocodeVariation(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const cleanAddress = address.replace(/\s+/g, '+');
      
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress)}&limit=1&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'MetalheadApp/1.0',
          },
          timeout: 10000,
        }
      );

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        if (this.isValidCoordinates(lat, lng)) {
          return { lat, lng };
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate multiple variations of an address to improve geocoding success
   */
  private generateAddressVariations(address: string): string[] {
    const variations = [address]; // Start with original

    // Common abbreviations and expansions
    const abbreviations = {
      'St': ['Street', 'St.'],
      'Ave': ['Avenue', 'Ave.'],
      'Rd': ['Road', 'Rd.'],
      'Blvd': ['Boulevard', 'Blvd.'],
      'Dr': ['Drive', 'Dr.'],
      'Ln': ['Lane', 'Ln.'],
      'Ct': ['Court', 'Ct.'],
      'Pl': ['Place', 'Pl.'],
      'NY': ['New York', 'NYC'],
      'CA': ['California'],
      'FL': ['Florida'],
      'TX': ['Texas'],
      'LA': ['Los Angeles'],
      'SF': ['San Francisco'],
      'DC': ['Washington DC', 'Washington D.C.'],
    };

    // Try with expanded abbreviations
    let expandedAddress = address;
    for (const [abbr, expansions] of Object.entries(abbreviations)) {
      for (const expansion of expansions) {
        if (address.includes(abbr)) {
          variations.push(address.replace(new RegExp(`\\b${abbr}\\b`, 'gi'), expansion));
        }
        if (address.includes(expansion)) {
          variations.push(address.replace(new RegExp(`\\b${expansion}\\b`, 'gi'), abbr));
        }
      }
    }

    // Try without common suffixes
    const suffixes = ['Street', 'Avenue', 'Road', 'Boulevard', 'Drive', 'Lane', 'Court', 'Place', 'St', 'Ave', 'Rd', 'Blvd', 'Dr', 'Ln', 'Ct', 'Pl'];
    for (const suffix of suffixes) {
      if (address.toLowerCase().includes(suffix.toLowerCase())) {
        variations.push(address.replace(new RegExp(`\\s+${suffix}\\b`, 'gi'), ''));
      }
    }

    // Try with different separators
    variations.push(address.replace(/,\s*/g, ' '));
    variations.push(address.replace(/\s+/g, ', '));

    // Try with country suffix if not present
    if (!address.toLowerCase().includes('usa') && !address.toLowerCase().includes('united states')) {
      variations.push(`${address}, USA`);
      variations.push(`${address}, United States`);
    }

    // Remove duplicates and return
    return [...new Set(variations)].slice(0, 5); // Limit to 5 variations to avoid too many API calls
  }

  /**
   * Reverse geocode coordinates to get address
   */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      if (!this.isValidCoordinates(lat, lng)) {
        this.logger.warn(`Invalid coordinates provided: (${lat}, ${lng})`);
        return null;
      }

      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'MetalheadApp/1.0',
          },
          timeout: 10000,
        }
      );

      if (response.data && response.data.display_name) {
        this.logger.log(`Successfully reverse geocoded: (${lat}, ${lng}) -> "${response.data.display_name}"`);
        return response.data.display_name;
      } else {
        this.logger.warn(`No address found for coordinates: (${lat}, ${lng})`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Reverse geocoding failed for coordinates: (${lat}, ${lng})`, error.message);
      return null;
    }
  }

  /**
   * Validate if coordinates are valid
   */
  private isValidCoordinates(lat: number, lng: number): boolean {
    return (
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !isNaN(lat) && !isNaN(lng)
    );
  }

  /**
   * Geocode multiple addresses in batch (with rate limiting)
   */
  async geocodeAddresses(addresses: string[]): Promise<Array<{ address: string; coordinates: { lat: number; lng: number } | null }>> {
    const results = [];
    
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      const coordinates = await this.geocodeAddress(address);
      
      results.push({
        address,
        coordinates,
      });

      // Rate limiting: Wait 1 second between requests to respect Nominatim's usage policy
      if (i < addresses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get coordinates for common city names (fallback for simple locations)
   */
  async geocodeCity(cityName: string): Promise<{ lat: number; lng: number } | null> {
    // Try with common city formats
    const cityFormats = [
      cityName,
      `${cityName}, USA`,
      `${cityName}, United States`,
      `${cityName}, US`,
    ];

    for (const format of cityFormats) {
      const result = await this.geocodeAddress(format);
      if (result) {
        return result;
      }
      
      // Wait between attempts
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return null;
  }
}
