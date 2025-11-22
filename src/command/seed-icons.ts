import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: 'cleaning', icon: 'cleaning-bucket.png' },
  { name: 'delivery', icon: 'van.svg' },
  { name: 'grocery_pickup', icon: 'shopping-bag-01.svg' },
  { name: 'yard_work', icon: 'flower-pot.svg' },
  { name: 'plumbing', icon: 'wrench-01.svg' },
  { name: 'electrical', icon: 'tools.svg' },
  { name: 'carpentry', icon: 'Frame.svg' },
  { name: 'painting', icon: 'Frame.svg' },
  { name: 'gardening', icon: 'flower-pot.svg' },
  { name: 'moving', icon: 'package-moving-01.svg' },
  { name: 'furniture_moving', icon: 'package.svg' },
  { name: 'appliance', icon: 'tools.svg' },
  { name: 'hvac', icon: 'Frame.svg' },
  { name: 'handyman', icon: 'home-01.svg' },
  { name: 'pet_care', icon: 'Frame.svg' },
  { name: 'errands_shopping', icon: 'shopping-bag-01.svg' },
  { name: 'assembly_installation', icon: 'Frame.svg' },
  { name: 'event_setup', icon:'calendar-04.svg' },
  { name: 'personal_assistance', icon: 'user.svg' },
  { name: 'tech_setup_repair', icon: 'laptop.svg' },
  { name: 'car_services', icon: 'car-05.svg' },
  { name: 'house_sitting', icon: 'child.svg' },
];

async function updateIconsOnly() {
  try {
    console.log('Updating category icons...\n');

    for (const category of categories) {
      const updated = await prisma.category.updateMany({
        where: { name: category.name },
        data: { icon: category.icon },
      });

      if (updated.count === 0) {
        console.log(`⚠️ Category not found: ${category.name}`);
      } else {
        console.log(`✓ Updated icon for: ${category.name}`);
      }
    }

    console.log('\n✅ Icons updated successfully!');
  } catch (error) {
    console.error('❌ Error updating icons:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateIconsOnly();
