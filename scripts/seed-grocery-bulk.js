#!/usr/bin/env node
/**
 * Bulk dummy grocery seeder — target ~2000 products across the existing
 * 5 categories (400 per category). Idempotent: skips any product whose
 * name already exists, so repeat runs insert nothing.
 *
 * Depends on categories already existing — run scripts/seed-grocery.js first.
 *
 * Run: node scripts/seed-grocery-bulk.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const logger = require('../src/config/logger');

const GroceryCategory = require('../src/models/GroceryCategory.model');
const GroceryProduct = require('../src/models/GroceryProduct.model');

const PER_CATEGORY = 400;

const CATEGORY_DATA = {
  Staples: {
    brands: ['Aashirvaad','Fortune','India Gate','Daawat','Tata Sampann','Patanjali','Organic Tattva','Nature Fresh','24 Mantra','Kohinoor','Dhara','Saffola','Mother Dairy','ITC Chakki','Everest','MDH','Catch','Shakti Bhog','Pillsbury','Rajdhani','Laxmi','Pro Nature','Gyan','Royal','Double Horse'],
    bases: ['Atta','Basmati Rice','Sona Masoori Rice','Toor Dal','Chana Dal','Moong Dal','Masoor Dal','Urad Dal','Besan','Suji','Maida','Poha','Sugar','Rock Salt','Jaggery','Refined Oil','Mustard Oil','Ghee','Honey','Vinegar'],
    sizes: [['500 g', 45, 120],['1 kg', 80, 220],['5 kg', 350, 900]],
    images: [
      'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400&q=80',
      'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&q=80',
      'https://images.unsplash.com/photo-1599909533730-10b05af2f2d1?w=400&q=80',
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
    ],
  },
  Dairy: {
    brands: ['Amul','Mother Dairy','Nestle','Britannia','Parag','Go','Epigamia','Danone','Govardhan','Heritage','Nandini','Aavin','Vita','Verka','Milky Mist','Paras','Tirumala','Gokul','Kwality','Sarvottam','Dodla','Hatsun','Chitale','Sudha','Sangam'],
    bases: ['Full Cream Milk','Toned Milk','Butter','Salted Butter','Cheese Slices','Mozzarella','Paneer','Dahi','Curd','Lassi','Chaas','Buttermilk','Cream','Ice Cream','Khoya','Condensed Milk','Pure Ghee','Flavoured Milk','Kulfi','Shrikhand'],
    sizes: [['200 g', 40, 110],['500 g', 75, 220],['1 L', 55, 180]],
    images: [
      'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80',
      'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80',
      'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&q=80',
      'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80',
    ],
  },
  Snacks: {
    brands: ["Lay's","Kurkure","Haldiram's","Bingo","Bikano","Balaji","Parle","Britannia","Sunfeast","Pringles","Too Yumm","Uncle Chipps","Bikaji","Ching's","Unibic","McVitie's","Tops","Priyagold","Cadbury","Nestle Maggi","Ferrero","Oreo","Hershey's","Dukes","Anmol"],
    bases: ['Classic Salted Chips','Masala Chips','Tangy Tomato Chips','Cream & Onion Chips','Aloo Bhujia','Moong Dal Namkeen','Sev','Mixture Namkeen','Butter Cookies','Glucose Biscuits','Cream Biscuits','Digestive Biscuits','Chocolate Cookies','Nachos','Popcorn','Mathri','Khakhra','Wafers','Crackers','Rusk'],
    sizes: [['Small (30 g)', 15, 35],['Medium (75 g)', 30, 70],['Large (150 g)', 60, 140]],
    images: [
      'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80',
      'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&q=80',
      'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',
    ],
  },
  Beverages: {
    brands: ['Coca-Cola','Pepsi','Sprite','Thums Up','Fanta','7UP','Mountain Dew','Frooti','Maaza','Slice','Real','Tropicana','Paper Boat','Minute Maid','Red Bull','Monster','Tata Tea','Taj Mahal','Red Label','Nescafe','Bru','Lipton','Society','Wagh Bakri','Continental'],
    bases: ['Original Soda','Diet Soda','Orange Juice','Apple Juice','Mixed Fruit Juice','Mango Drink','Lemon Drink','Iced Tea','Green Tea','Black Tea','Masala Chai','Coffee Powder','Instant Coffee','Energy Drink','Coconut Water','Aam Panna','Jaljeera','Rose Drink','Lassi Drink','Salted Buttermilk'],
    sizes: [['250 ml', 20, 40],['500 ml', 30, 80],['1 L', 55, 140],['2 L', 90, 200]],
    images: [
      'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80',
      'https://images.unsplash.com/photo-1600271886742-f049e4f7f9dd?w=400&q=80',
      'https://images.unsplash.com/photo-1597318181218-c6e6337b8771?w=400&q=80',
      'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80',
    ],
  },
  Household: {
    brands: ['Surf Excel','Ariel','Tide','Rin','Wheel','Ghadi','Nirma','Vim','Pril','Fena','Dettol','Lizol','Harpic','Domex','Colin','Fogg','Odonil','Hit','Mortein','Santoor','Lux','Dove','Cinthol','Lifebuoy','Godrej'],
    bases: ['Detergent Powder','Liquid Detergent','Dish Wash Bar','Dish Wash Liquid','Floor Cleaner','Toilet Cleaner','Glass Cleaner','Bathroom Cleaner','Air Freshener','Mosquito Repellent','Hand Wash','Bath Soap','Antiseptic Liquid','Phenyl','Bleach','Fabric Conditioner','Room Spray','Kitchen Cleaner','Tiles Cleaner','Drain Cleaner'],
    sizes: [['200 g', 25, 80],['500 g', 60, 180],['1 kg', 110, 330],['2 L', 200, 650]],
    images: [
      'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400&q=80',
      'https://images.unsplash.com/photo-1600857062241-98ef96a7e3db?w=400&q=80',
    ],
  },
  'Fruits & Vegetables': {
    brands: ['Fresho','BB Royal','Organic Tattva','Nature\'s Basket','Safal','Qrate','Farm2Kitchen','Patanjali Fresh','Desi Farms','Deep','Nilon\'s','iD Fresh','24 Mantra','Pro Nature','FreshLo','Fieldking','Kisan','Godrej Fresh','Heritage Farm','Whole Farm','Veggie Fresh','Green Harvest','Namdhari','First Choice','Zespri'],
    bases: ['Apple','Banana','Orange','Pomegranate','Grapes','Papaya','Watermelon','Mango','Pear','Kiwi','Onion','Tomato','Potato','Carrot','Cucumber','Lady Finger','Brinjal','Cabbage','Cauliflower','Spinach','Coriander','Mint','Lemon','Ginger','Garlic','Green Chilli','Capsicum','Bottle Gourd','Pumpkin','Beetroot'],
    sizes: [['250 g', 20, 60],['500 g', 35, 120],['1 kg', 60, 240]],
    images: [
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
      'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&q=80',
      'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=400&q=80',
      'https://images.unsplash.com/photo-1566842600175-97dca3c5ad01?w=400&q=80',
    ],
  },
  Bakery: {
    brands: ['Britannia','Modern','English Oven','Harvest Gold','Winkies','Theobroma','Monginis','Loafers','Bon Ami','The Baker\'s Dozen','Brown Sugar','Karachi','Fresh Bakery','Wibs','Elite','Bonn','Perfetto','MIO AMORE','Dukes','Chheda\'s','Unibic','Karachi Bakery','Sunfeast','McVitie\'s','Parle'],
    bases: ['White Bread','Brown Bread','Multigrain Bread','Whole Wheat Bread','Pav','Fruit Bun','Cream Bun','Croissant','Bagel','Muffin','Cup Cake','Pound Cake','Plum Cake','Chocolate Pastry','Brownie','Butter Cookies','Donut','Rusk','Toast','Pizza Base','Burger Bun','Garlic Bread','Focaccia','Danish','Eclair'],
    sizes: [['Pack of 4', 30, 90],['Pack of 6', 45, 140],['Pack of 12', 80, 260]],
    images: [
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80',
      'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400&q=80',
      'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80',
      'https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=400&q=80',
    ],
  },
  'Masala & Spices': {
    brands: ['MDH','Everest','Catch','Tata Sampann','Ramdev','Aashirvaad','Badshah','Patanjali','Urban Platter','Goldiee','Sakthi','Eastern','Shakti','Priya','Priyanka','Mother\'s Recipe','Deep','Suhana','Pushp','Shalimar','Keya','Double Horse','Aachi','Dabur','Nilon\'s'],
    bases: ['Turmeric Powder','Red Chilli Powder','Coriander Powder','Cumin Powder','Garam Masala','Chaat Masala','Sambar Masala','Biryani Masala','Pav Bhaji Masala','Meat Masala','Kitchen King','Chicken Masala','Rajma Masala','Chhole Masala','Tandoori Masala','Pani Puri Masala','Dhaniya Powder','Hing Powder','Saunf','Ajwain','Black Pepper','Cardamom','Cinnamon','Clove','Bay Leaf'],
    sizes: [['100 g', 30, 100],['200 g', 55, 180],['500 g', 120, 400]],
    images: [
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&q=80',
      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80',
      'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=400&q=80',
      'https://images.unsplash.com/photo-1501430654243-c934cec2e1c0?w=400&q=80',
    ],
  },
  'Oil & Ghee': {
    brands: ['Fortune','Saffola','Dhara','Sundrop','Engine','Gemini','Mahakosh','Patanjali','Amul','Mother Dairy','Gowardhan','Anik','Nutrela','Gagan','Freedom','Ruchi Gold','Postman','Tirupati','Idhayam','Kachi Ghani','Figaro','Olitalia','Bertolli','Borges','Leonardo'],
    bases: ['Refined Oil','Mustard Oil','Sunflower Oil','Rice Bran Oil','Groundnut Oil','Coconut Oil','Olive Oil','Cow Ghee','Pure Ghee','Desi Ghee','Vanaspati','Soyabean Oil','Palm Oil','Canola Oil','Sesame Oil','Flaxseed Oil','Kachi Ghani Oil','Filtered Oil','A2 Ghee','Buffalo Ghee'],
    sizes: [['500 ml', 80, 220],['1 L', 140, 380],['5 L', 650, 1700]],
    images: [
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80',
      'https://images.unsplash.com/photo-1599003037890-5a6e9325ff06?w=400&q=80',
      'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?w=400&q=80',
      'https://images.unsplash.com/photo-1611735341450-74d61e660ad2?w=400&q=80',
    ],
  },
  'Personal Care': {
    brands: ['Dove','Lux','Lifebuoy','Santoor','Cinthol','Godrej','Patanjali','Himalaya','Nivea','Vaseline','Parachute','Dabur','Pond\'s','Head & Shoulders','Clinic Plus','Sunsilk','Pantene','Garnier','L\'Oreal','Colgate','Sensodyne','Pepsodent','Oral-B','Gillette','Old Spice'],
    bases: ['Bath Soap','Body Wash','Shampoo','Conditioner','Hair Oil','Face Wash','Body Lotion','Toothpaste','Toothbrush','Deodorant','Talc','Face Cream','Sunscreen','Shaving Foam','Razor','Hair Gel','Hair Color','Kajal','Lip Balm','Perfume','Moisturizer','Hand Cream','Foot Cream','Mouthwash','Cotton Buds'],
    sizes: [['100 g', 40, 140],['200 g', 70, 240],['500 g', 150, 480]],
    images: [
      'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400&q=80',
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&q=80',
      'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=400&q=80',
      'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&q=80',
    ],
  },
  'Breakfast & Cereals': {
    brands: ["Kellogg's",'Quaker','Saffola','Bagrry\'s','Nestle','Sunfeast','Patanjali','True Elements','Yogabar','Soulfull','MuscleBlaze','Disano','Wingreens','Du\'s','RiteBite','Nutri Choice','Britannia','Cornitos','Horlicks','Bournvita','Complan','Pediasure','Protinex','Ensure','Amul Pro'],
    bases: ['Corn Flakes','Chocos','Muesli','Oats','Rolled Oats','Masala Oats','Granola','Porridge','Poha','Upma Mix','Dalia','Idli Mix','Dosa Mix','Vermicelli','Instant Pongal','Ragi Flakes','Wheat Flakes','Choco Fills','Honey Flakes','Nut Granola','Protein Muesli','Millet Flakes','Health Drink Powder','Diabetic Oats','Fiber Mix'],
    sizes: [['200 g', 80, 180],['500 g', 170, 380],['1 kg', 320, 720]],
    images: [
      'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=400&q=80',
      'https://images.unsplash.com/photo-1567103472667-6898f3a79cf2?w=400&q=80',
      'https://images.unsplash.com/photo-1521483451569-e33803c0330c?w=400&q=80',
    ],
  },
  'Atta & Flours': {
    brands: ['Aashirvaad','Fortune','Pillsbury','ITC Chakki','Annapurna','Patanjali','24 Mantra','Shakti Bhog','Rajdhani','Nature Fresh','MultiGrain','Pro Nature','Organic Tattva','Sujata','Sunrise','Ganesh','Zindagi','Bambino','Golden Harvest','Tata Sampann','Disano','Double Horse','Nilon\'s','Priya','Deep'],
    bases: ['Whole Wheat Atta','MultiGrain Atta','Sharbati Atta','Chakki Atta','Maida','Suji','Besan','Corn Flour','Bajra Flour','Jowar Flour','Ragi Flour','Oats Flour','Rice Flour','Moong Flour','Rajgira Flour','Singhara Flour','Soya Flour','Barley Flour','Millet Flour','Nachni Flour','Arhar Flour','Urad Flour','Masoor Flour','Chana Flour','Wheat Grain'],
    sizes: [['1 kg', 55, 120],['5 kg', 220, 550],['10 kg', 430, 1050]],
    images: [
      'https://images.unsplash.com/photo-1546554137-f86b9593a222?w=400&q=80',
      'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400&q=80',
    ],
  },
  'Rice & Rice Products': {
    brands: ['India Gate','Daawat','Kohinoor','Fortune','Lal Qilla','Tilda','Charminar','Patel','Dawat','Falak','Kanishk','Royal','Double Horse','Pari','Swastik','Aeroplane','Aashirvaad','Nature Fresh','24 Mantra','Basmati King','Rajdhani','Patanjali','Organic India','Bansi','Shriram'],
    bases: ['Basmati Rice','Sona Masoori','Kolam Rice','Ponni Rice','Red Rice','Brown Rice','Idli Rice','Poha','Puffed Rice','Rice Flakes','Matta Rice','Jasmine Rice','Parboiled Rice','Sella Rice','Broken Rice','Black Rice','Ambemohar Rice','Gobindobhog Rice','Jeerakasala Rice','Pulao Rice','Biryani Rice','Rice Noodles','Rice Sewai','Beaten Rice','Rice Bran'],
    sizes: [['1 kg', 80, 220],['5 kg', 380, 1050],['10 kg', 720, 2000]],
    images: [
      'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&q=80',
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
    ],
  },
  'Dals & Pulses': {
    brands: ['Tata Sampann','24 Mantra','Fortune','Aashirvaad','Patanjali','Nature Fresh','Organic Tattva','Rajdhani','Pro Nature','Kissan','Pristine','ITC','BB Royal','Double Horse','Gulab','Ganesh','Patel','Zuari','Laxmi','Shree','Sohum','Farmonics','Desi Farms','Deep','Maiyas'],
    bases: ['Toor Dal','Chana Dal','Moong Dal','Urad Dal','Masoor Dal','Kabuli Chana','Black Chana','Rajma','Green Moong','Yellow Moong','Lobia','Horse Gram','Matki','Arhar Dal','Split Urad','Broken Dal','Whole Masoor','Red Kidney Beans','Black Eyed Beans','Soya Chunks','Soyabean','Dry Peas','Green Peas','Double Beans','Mixed Dal'],
    sizes: [['500 g', 55, 140],['1 kg', 100, 260],['2 kg', 180, 500]],
    images: [
      'https://images.unsplash.com/photo-1599909533730-10b05af2f2d1?w=400&q=80',
      'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400&q=80',
    ],
  },
  'Dry Fruits & Nuts': {
    brands: ['Happilo','Nutraj','Farmley','Tulsi','Wonderland','Borges','Graminway','Manna','Vedaka','True Elements','Yoga Bar','Rostaa','Almond House','Nutty Yogi','BB Royal','Paper Boat','Lo! Foods','Urban Platter','Sorich Organics','Divo','Nutmix','Haldiram\'s','Sapphire','California','Sohum'],
    bases: ['Almonds','Cashews','Pistachios','Walnuts','Raisins','Black Raisins','Dates','Dried Figs','Apricots','Pecan Nuts','Macadamia','Hazelnuts','Pine Nuts','Brazil Nuts','Dried Cranberries','Dried Blueberries','Prunes','Chironji','Makhana','Sunflower Seeds','Pumpkin Seeds','Chia Seeds','Flax Seeds','Sesame Seeds','Mixed Nuts'],
    sizes: [['200 g', 180, 550],['500 g', 400, 1200],['1 kg', 750, 2400]],
    images: [
      'https://images.unsplash.com/photo-1508747703725-719777637510?w=400&q=80',
      'https://images.unsplash.com/photo-1599909533730-10b05af2f2d1?w=400&q=80',
    ],
  },
  Chocolates: {
    brands: ['Cadbury','Nestle','Ferrero','Amul','Lindt','Hershey\'s','Mars','Lotte','Bournville','Galaxy','Toblerone','Snickers','Kit Kat','Dairy Milk','Oreo','Mondelez','Morde','Campco','Lotus','Hippo','Tempt','Pascha','Lakerol','Dukes','Fabelle'],
    bases: ['Milk Chocolate','Dark Chocolate','White Chocolate','Almond Chocolate','Fruit & Nut','Wafer Chocolate','Truffle','Filled Chocolate','Chocolate Bar','Cookie Chocolate','Crunchy Chocolate','Silk Chocolate','Orange Chocolate','Caramel Chocolate','Hazelnut Chocolate','Mint Chocolate','Bitter Chocolate','Cocoa Powder','Chocolate Box','Chocolate Gift Pack'],
    sizes: [['50 g', 40, 120],['100 g', 80, 220],['250 g', 180, 500]],
    images: [
      'https://images.unsplash.com/photo-1511381939415-e44015466834?w=400&q=80',
      'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80',
    ],
  },
  'Sweets & Desserts': {
    brands: ['Haldiram\'s','Bikaji','Bikano','Priyagold','Chitale','MTR','Gits','Kwality','Ananda','Amul','Surati','Anand','Balaji','Ganesh','Bhavnagri','Kailash','Krishna','Laxmi','Maya','Murli','Natraj','Pooja','Rajbhog','Sangam','Shri'],
    bases: ['Gulab Jamun','Rasgulla','Soan Papdi','Kaju Katli','Besan Ladoo','Motichoor Ladoo','Bundi','Jalebi','Milk Cake','Barfi','Peda','Halwa','Mysore Pak','Rasmalai','Gajar Halwa','Kheer','Firni','Sewaiyan','Gajak','Chikki','Patisa','Badam Burfi','Coconut Burfi','Kaju Roll','Mava Barfi'],
    sizes: [['250 g', 80, 240],['500 g', 150, 480],['1 kg', 280, 950]],
    images: [
      'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80',
    ],
  },
  'Ice Cream': {
    brands: ['Amul','Kwality Walls','Mother Dairy','Vadilal','Havmor','Baskin Robbins','Magnum','Creambell','Dinshaw\'s','Arun','Naturals','London Dairy','Minute Maid','Cornetto','Cassata','Gelato','Polar','Gcmmf','Heritage','Scoops','Sweet Truth','Hokey Pokey','Belgian','Haagen Dazs','Top N Town'],
    bases: ['Vanilla Ice Cream','Chocolate Ice Cream','Strawberry Ice Cream','Butterscotch Ice Cream','Cookies & Cream','Kesar Pista','Mango Ice Cream','Black Currant','Tutti Frutti','Choco Chips','Kulfi','Matka Kulfi','Ice Cream Bar','Ice Cream Cone','Ice Cream Tub','Family Pack','Ice Cream Cake','Sundae','Sandwich','Popsicle'],
    sizes: [['100 ml', 40, 120],['500 ml', 150, 400],['1 L', 280, 700]],
    images: [
      'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&q=80',
      'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&q=80',
    ],
  },
  'Frozen Foods': {
    brands: ['Godrej Yummiez','ITC Master Chef','Sumeru','McCain','Venky\'s','Real Good','Zorabian','Al Kabeer','Golden Harvest','Tifnova','Vista','Zappfresh','Licious','Meatigo','FreshToHome','Mother Dairy','Safal','Parag','ID Fresh','Doux','Chakki','Crax','Brekz','Amul','Cohen\'s'],
    bases: ['Frozen Vegetables','Green Peas','Frozen Corn','Frozen Fries','Aloo Tikki','Paneer Tikka','Veg Spring Roll','Cheese Balls','Veg Nuggets','Chicken Nuggets','Chicken Seekh','Chicken Sausage','Chicken Salami','Mutton Mince','Fish Finger','Prawns','Smiley Fries','Frozen Parathas','Mixed Vegetables','Chicken Patty','Chicken Patties','Frozen Kebabs','Masala Fries','Mozzarella Sticks','Frozen Dumplings'],
    sizes: [['200 g', 80, 220],['500 g', 180, 500],['1 kg', 330, 950]],
    images: [
      'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=400&q=80',
      'https://images.unsplash.com/photo-1587736795693-6e38731e1bfa?w=400&q=80',
    ],
  },
  'Sauces & Ketchups': {
    brands: ['Kissan','Maggi','Heinz','Del Monte','Veeba','Wingreens','Ching\'s','Cremica','Dr. Oetker','Tops','Hellmann\'s','American Garden','Tabasco','Sirocco','Rupali','Funfoods','Deep','Mrs Bector\'s','Urban Platter','Smith & Jones','Priya','Nilon\'s','Fun Foods','Cornitos','Lee Kum Kee'],
    bases: ['Tomato Ketchup','Chilli Sauce','Green Chilli Sauce','Soy Sauce','Schezwan Sauce','Mayonnaise','Eggless Mayonnaise','Mustard Sauce','BBQ Sauce','Pasta Sauce','Pizza Sauce','Garlic Sauce','Tandoori Sauce','Peri Peri Sauce','Hot Sauce','Vinegar','Hot & Sweet','Thousand Island','Tartare Sauce','Ranch Dressing','Caesar Dressing','Worcestershire','Balsamic Vinegar','Olive Dressing','Hoisin Sauce'],
    sizes: [['200 g', 45, 140],['500 g', 90, 280],['1 kg', 160, 520]],
    images: [
      'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=400&q=80',
      'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400&q=80',
    ],
  },
  'Jams & Spreads': {
    brands: ['Kissan','Druk','Fun Foods','Mala\'s','Tops','Dabur','Nutralite','Hershey\'s','Mapro','Del Monte','Urban Platter','Pintola','Yoga Bar','The Butternut Co.','MyFitness','Saffola','Sundrop','Smith & Jones','Organic India','The Butternut','Taloja','Go Healthy','Fabbri','Saporito','Heinz'],
    bases: ['Mixed Fruit Jam','Strawberry Jam','Mango Jam','Pineapple Jam','Orange Marmalade','Peanut Butter','Almond Butter','Cashew Butter','Hazelnut Spread','Chocolate Spread','Nutella','Honey','Maple Syrup','Butter Scotch Spread','Date Syrup','Fruit Preserve','Apricot Jam','Blueberry Jam','Jaggery Spread','Coconut Spread','Cheese Spread','Choco Hazelnut','Pistachio Spread','Vanilla Spread','Caramel Spread'],
    sizes: [['200 g', 80, 220],['400 g', 150, 420],['800 g', 280, 780]],
    images: [
      'https://images.unsplash.com/photo-1600271886742-f049e4f7f9dd?w=400&q=80',
      'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=400&q=80',
    ],
  },
  'Pickles & Chutneys': {
    brands: ['Mother\'s Recipe','Priya','Nilon\'s','Pachranga','Ruchi','Bedekar','Patanjali','MDH','Everest','Dabur','Maggi','Swad','Tops','Kissan','Wingreens','Del Monte','Chitale','Aachi','Deep','Sriram','Lijjat','Amul','BB Royal','Cherish','Organic Tattva'],
    bases: ['Mango Pickle','Mixed Pickle','Lemon Pickle','Chilli Pickle','Garlic Pickle','Ginger Pickle','Gongura Pickle','Avakaya','Sweet Mango Pickle','Tamarind Chutney','Mint Chutney','Coconut Chutney','Coriander Chutney','Date Chutney','Green Chutney','Red Chutney','Instant Pickle','Kasundi','Nimbu Pickle','Aam Ka Achar','Gunda Pickle','Methi Pickle','Carrot Pickle','Amla Pickle','Olive Pickle'],
    sizes: [['200 g', 50, 160],['500 g', 110, 330],['1 kg', 200, 600]],
    images: [
      'https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=400&q=80',
      'https://images.unsplash.com/photo-1628191139360-bc7a51f66b40?w=400&q=80',
    ],
  },
  'Noodles & Pasta': {
    brands: ['Maggi','Yippee','Top Ramen','Wai Wai','Sunfeast','Knorr','Chings','Del Monte','Nissin','Samyang','Patanjali','Foodles','Smith & Jones','Tasty Treat','Disano','Bambino','Indomie','Amba','Borges','Goldiee','Barilla','San Remo','Weikfield','Cornitos','Urban Platter'],
    bases: ['Masala Noodles','Atta Noodles','Curry Noodles','Veg Noodles','Hakka Noodles','Schezwan Noodles','Ramen Noodles','Instant Noodles','Cup Noodles','Macaroni','Penne Pasta','Spaghetti','Fusilli','Lasagne','Rigatoni','Farfalle','Whole Wheat Pasta','Masala Pasta','White Sauce Pasta','Red Sauce Pasta','Cheese Pasta','Ravioli','Orzo','Rice Noodles','Egg Noodles'],
    sizes: [['100 g', 15, 60],['400 g', 60, 180],['1 kg', 180, 480]],
    images: [
      'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&q=80',
      'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400&q=80',
    ],
  },
  'Ready to Eat': {
    brands: ['MTR','Haldiram\'s','ITC','Kohinoor','Gits','Maggi','Knorr','Tasty Bite','Bambino','Priya','Patanjali','Amul','Nilon\'s','Chings','Mother\'s Recipe','Ashirwaad','Desi','Weikfield','24 Mantra','Organic Tattva','Veeba','Ashirwad','Satvik','Nila','Smith & Jones'],
    bases: ['Dal Makhani','Paneer Butter Masala','Chole','Rajma','Palak Paneer','Kadhai Paneer','Shahi Paneer','Matar Paneer','Mix Vegetable','Aloo Matar','Biryani Mix','Pulao Mix','Upma Mix','Poha Mix','Idli Mix','Dosa Mix','Sambar Mix','Rasam Mix','Sabji Mix','Khichdi Mix','Paratha Mix','Thepla Mix','Dhokla Mix','Vada Mix','Halwa Mix'],
    sizes: [['200 g', 60, 160],['400 g', 110, 300],['1 kg', 260, 700]],
    images: [
      'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80',
      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80',
    ],
  },
  'Biscuits & Cookies': {
    brands: ['Britannia','Parle','Sunfeast','Oreo','Unibic','McVitie\'s','Cadbury','Nutri Choice','Good Day','Bourbon','Krackjack','Marie Gold','Little Hearts','Hide & Seek','Bake Lite','Dark Fantasy','Tiger','Monaco','Jim Jam','Priya Gold','Cremica','Dukes','Anmol','Biskfarm','Patanjali'],
    bases: ['Cream Biscuits','Digestive Biscuits','Marie Biscuits','Glucose Biscuits','Butter Cookies','Chocolate Cookies','Choco Chip','Oats Biscuits','Salt Biscuits','Cheese Cracker','Ginger Cookies','Nankhatai','Milk Biscuit','Coconut Biscuit','Multigrain Biscuit','Protein Biscuit','Sugar Free','Jeera Biscuit','Rusk','Toast','Wafers','Sandwich Biscuit','Fruit Cookie','Peanut Cookie','Khari Biscuit'],
    sizes: [['100 g', 15, 60],['200 g', 30, 120],['500 g', 70, 280]],
    images: [
      'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',
      'https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=400&q=80',
    ],
  },
  'Chips & Namkeen': {
    brands: ['Lay\'s','Bingo','Kurkure','Haldiram\'s','Balaji','Bikaji','Bikano','Too Yumm','Pringles','Uncle Chipps','Mad Angles','Cheetos','Doritos','Cornitos','Tastilo','Anand','Chheda','Ganesh','A To Z','Hippo','Desi Treat','MTR','Patanjali','Moolchand','Sugandh'],
    bases: ['Classic Salted Chips','Masala Chips','Cream Onion Chips','Tomato Chips','Salt Pepper Chips','Aloo Bhujia','Moong Dal','Khatta Meetha','Mixture','Sev','Boondi','Chana Dal','Banana Chips','Plantain Chips','Ringo','Makhana Namkeen','Nimbu Masala','Navratan','Chatak Aloo','Bhel','Fryums','Wafers','Chakli','Chivda','Peanuts Masala'],
    sizes: [['30 g', 10, 25],['90 g', 25, 70],['200 g', 60, 180]],
    images: [
      'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80',
      'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&q=80',
    ],
  },
  Tea: {
    brands: ['Tata Tea','Taj Mahal','Red Label','Society','Wagh Bakri','Lipton','Tetley','Nature\'s Gift','Assam Tea','Girnar','Typhoo','Twinings','Organic India','Dilmah','Darjeeling Gold','Marvel','Gemini','Kanan Devan','Nilgiri','Three Roses','Sangam','Goodricke','Tea Floor','Kanan','Brooke Bond'],
    bases: ['Premium Tea','Gold Tea','Masala Chai','Elaichi Tea','Adrak Chai','Green Tea','Lemon Green Tea','Honey Tea','Jasmine Tea','Earl Grey','English Breakfast','Chamomile Tea','Herbal Tea','Black Tea','Darjeeling Tea','Assam Tea','Nilgiri Tea','Tulsi Tea','Peppermint Tea','Detox Tea','Weight Loss Tea','Iced Tea','Ginger Tea','Kahwa','Hibiscus Tea'],
    sizes: [['100 g', 60, 180],['250 g', 150, 420],['500 g', 280, 800]],
    images: [
      'https://images.unsplash.com/photo-1597318181218-c6e6337b8771?w=400&q=80',
      'https://images.unsplash.com/photo-1545048709-9fa36c1ad9a2?w=400&q=80',
    ],
  },
  Coffee: {
    brands: ['Nescafe','Bru','Tata Coffee','Continental','Davidoff','Starbucks','Moccona','Colombian Brew','Country Bean','Levista','Sleepy Owl','Blue Tokai','Rage','Vienna','Narasu\'s','CCD','Cothas','Mountain Trail','Fika','Abe\'s','Araku','Beanly','InstaCoffee','Nestle','Ikiru'],
    bases: ['Instant Coffee','Classic Coffee','Gold Coffee','Filter Coffee','Cappuccino','Mocha','Latte','Espresso','Cold Brew','Coffee Beans','Ground Coffee','Decaf Coffee','Flavored Coffee','Hazelnut Coffee','Vanilla Coffee','Caramel Coffee','Chicory Coffee','French Press Coffee','Turkish Coffee','Arabica Coffee','Robusta Coffee','Coffee Powder','Coffee Capsules','Coffee Sachets','Coffee Premix'],
    sizes: [['50 g', 90, 280],['100 g', 170, 500],['200 g', 320, 900]],
    images: [
      'https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&q=80',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80',
    ],
  },
  Juices: {
    brands: ['Real','Tropicana','Paper Boat','B Natural','Minute Maid','Slice','Frooti','Appy','Maaza','Dabur','Raw Pressery','Hector','RAW','Storia','Epigamia','Fruits Up','Taste Nirvana','Dole','Onjus','Patanjali','Parle Agro','Fruity','Coolberg','Manpasand','Balaji'],
    bases: ['Mixed Fruit Juice','Orange Juice','Apple Juice','Pineapple Juice','Mango Juice','Guava Juice','Litchi Juice','Pomegranate Juice','Cranberry Juice','Watermelon Juice','Grape Juice','Carrot Juice','Beetroot Juice','Amla Juice','Aloe Vera Juice','Tender Coconut','Mosambi Juice','Strawberry Juice','Blueberry Juice','Orange Nectar','Fruit Splash','Mixed Berry','Exotic Fruit','Masala Juice','Lime Juice'],
    sizes: [['200 ml', 20, 50],['1 L', 80, 200],['1.5 L', 120, 280]],
    images: [
      'https://images.unsplash.com/photo-1600271886742-f049e4f7f9dd?w=400&q=80',
      'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&q=80',
    ],
  },
  'Soft Drinks': {
    brands: ['Coca-Cola','Pepsi','Thums Up','Sprite','Fanta','7UP','Mountain Dew','Limca','Mirinda','Slice','Mazza','Appy Fizz','Paper Boat','Bovonto','Dukes','Cola King','Chinar','Ginger Ale','RC Cola','Schweppes','Polo','Barbican','Rogers','Pascoe\'s','Crown'],
    bases: ['Cola','Diet Cola','Zero Sugar Cola','Lemon Soda','Orange Drink','Cream Soda','Ginger Beer','Tonic Water','Club Soda','Root Beer','Cherry Cola','Vanilla Cola','Iced Tea','Lime Soda','Masala Soda','Mint Soda','Apple Fizz','Grape Soda','Strawberry Soda','Pineapple Soda','Jeera Soda','Nimbu Pani','Banta','Jaljeera','Nimboo Soda'],
    sizes: [['250 ml', 15, 35],['600 ml', 30, 75],['2 L', 80, 180]],
    images: [
      'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80',
      'https://images.unsplash.com/photo-1624552184280-9e9631bbeee9?w=400&q=80',
    ],
  },
  'Energy Drinks': {
    brands: ['Red Bull','Monster','Sting','Gatorade','Powerade','Cloud 9','XXX','Hell','Tzinga','Mountain Dew','Rockstar','Burn','Tonic','NOS','Razor','V','Relentless','Lucozade','Boost','Dragon','Yeo\'s','Pocari Sweat','Power Ade','Fast','Charged'],
    bases: ['Original Energy Drink','Sugar Free','Tropical Energy','Berry Blast','Lemon Energy','Zero Calorie','Performance Drink','Sports Drink','Electrolyte Drink','Endurance Drink','Pre Workout','Post Workout','Natural Energy','Caffeine Drink','Guarana Drink','Focus Drink','Herbal Energy','Mango Energy','Apple Energy','Peach Energy','Orange Energy','Coffee Energy','Ginseng Drink','Vitamin Drink','Hydration Drink'],
    sizes: [['250 ml', 50, 150],['500 ml', 90, 280],['1 L', 170, 520]],
    images: [
      'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80',
      'https://images.unsplash.com/photo-1601493700750-58da8585469c?w=400&q=80',
    ],
  },
  Water: {
    brands: ['Bisleri','Aquafina','Kinley','Himalayan','Bailey','Oxyrich','Rail Neer','Qua','Evian','Perrier','San Pellegrino','Voss','Acqua Panna','Mountain Drops','Aava','Clearly Pure','Vaya','Tata Springs','Catch','Clear','Rivogreen','Boon','Aanchal','Saikripa','Moxie'],
    bases: ['Mineral Water','Spring Water','Sparkling Water','Flavored Water','Alkaline Water','Electrolyte Water','Coconut Water','Tender Coconut','Lemon Water','Cucumber Water','Detox Water','Fruit Water','Natural Water','Premium Water','Artesian Water','Glacial Water','Fortified Water','Vitamin Water','Mint Water','Berry Water','Orange Water','Peach Water','Mango Water','Baby Water','Still Water'],
    sizes: [['500 ml', 10, 30],['1 L', 20, 60],['2 L', 30, 120]],
    images: [
      'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80',
      'https://images.unsplash.com/photo-1563246295-e5b2cc6d3400?w=400&q=80',
    ],
  },
  'Baby Food': {
    brands: ['Nestle Cerelac','Gerber','Farex','Nestum','Slurrp Farm','Pediasure','Mother\'s Horlicks','Manna','Timios','Happa','Pro V','Early Foods','Apricot','Only Organic','Mamy Poko','Goodness','Pristine Organics','First Cry','Beech Nut','HiPP','Holle','Plum Organics','Ella\'s Kitchen','Nurture Spring','Britannia'],
    bases: ['Wheat Cereal','Rice Cereal','Fruit Cereal','Vegetable Cereal','Multigrain Cereal','Rice Mixed','Apple Cereal','Banana Cereal','Ragi Cereal','Protein Cereal','Millet Porridge','Baby Puree','Fruit Puree','Baby Biscuits','Baby Snack','Teething Biscuits','Milk Formula','Follow Up Formula','Infant Formula','Toddler Food','Baby Juice','Baby Rusks','Growth Drink','Baby Soup','Starter Food'],
    sizes: [['200 g', 120, 320],['400 g', 220, 580],['1 kg', 500, 1350]],
    images: [
      'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=400&q=80',
      'https://images.unsplash.com/photo-1591389703635-e15a07b842d7?w=400&q=80',
    ],
  },
  'Paneer & Cheese': {
    brands: ['Amul','Mother Dairy','Britannia','Go','Parag','Milky Mist','Epigamia','Heritage','Parmalat','Dodla','Paras','Nestle','Arla','Kraft','Laughing Cow','Himalayan Nut','Flanders','MilkyWay','Sri Krishna','Ananda','Nandini','Aavin','Verka','Sarvottam','Vita'],
    bases: ['Fresh Paneer','Malai Paneer','Smoked Paneer','Paneer Cubes','Cottage Cheese','Cheese Slices','Processed Cheese','Mozzarella Cheese','Cheddar Cheese','Parmesan Cheese','Gouda Cheese','Feta Cheese','Cream Cheese','Cheese Spread','Pizza Cheese','Cheese Blocks','Cheese Cubes','Cheese Powder','Blue Cheese','Smoked Cheese','Flavored Cheese','Grated Cheese','Low Fat Cheese','Organic Paneer','Bocconcini'],
    sizes: [['100 g', 45, 140],['200 g', 80, 260],['500 g', 180, 600]],
    images: [
      'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=80',
      'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&q=80',
    ],
  },
  'Curd & Yogurt': {
    brands: ['Amul','Mother Dairy','Nestle','Britannia','Epigamia','Danone','Heritage','Parag','Milky Mist','Drums Food','Dodla','Paras','Nandini','Verka','Sangam','Hatsun','Tirumala','Gowardhan','Chitale','Aavin','Sudha','Sangam','Para\'s','Jersey','Gokul'],
    bases: ['Plain Curd','Probiotic Curd','Low Fat Curd','Greek Yogurt','Flavored Yogurt','Strawberry Yogurt','Mango Yogurt','Vanilla Yogurt','Set Curd','Whisked Curd','Homemade Style','Fruit Yogurt','Honey Yogurt','Cucumber Dahi','Hung Curd','Drinkable Yogurt','Lassi','Buttermilk','Sweet Lassi','Plain Lassi','Mango Lassi','Masala Chaas','Jeera Chaas','Pineapple Yogurt','Coconut Yogurt'],
    sizes: [['200 g', 25, 70],['400 g', 45, 130],['1 kg', 85, 260]],
    images: [
      'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&q=80',
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80',
    ],
  },
  Eggs: {
    brands: ['Keggs','Henfruit','IB','Suguna','SRS','Big Bazaar','Farm Fresh','Happy Hens','Country Eggs','Eggoz','Anda','OvoBel','Nutraj','Village Farm','Natural Choice','Laxmi','Saptarshi','VH','OFB','Egg Palace','Aavin','Suguna Daily Fresh','Agarwal','Venky\'s','Koyenco'],
    bases: ['White Eggs','Brown Eggs','Free Range Eggs','Organic Eggs','Farm Fresh Eggs','Protein Rich Eggs','Omega Eggs','Kadaknath Eggs','Country Eggs','Desi Eggs','Gym Eggs','Pasteurized Eggs','Liquid Eggs','Egg Whites','Duck Eggs','Quail Eggs','Egg Powder','Boiled Eggs','Pink Eggs','Jumbo Eggs','Medium Eggs','Small Eggs','Cholesterol Free','Fortified Eggs','Free Range Brown'],
    sizes: [['Pack of 6', 40, 90],['Pack of 12', 75, 180],['Pack of 30', 170, 400]],
    images: [
      'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=400&q=80',
      'https://images.unsplash.com/photo-1569288063643-5d29ad64df09?w=400&q=80',
    ],
  },
  'Chicken & Meat': {
    brands: ['Licious','FreshToHome','Nutrich','Meatigo','Zappfresh','Real Good','Godrej','ID Fresh','Krazy Fresh','Zorabian','BB Daily','Prasuma','Mr. Butcher','Venky\'s','Suguna','Tenderbites','Al Kabeer','Rishtaa','Keventer','Local Butcher','Chicken Salim','Zuari','Jivo','Pride Of Cows','Anglo\'s'],
    bases: ['Chicken Curry Cut','Chicken Breast','Chicken Drumsticks','Chicken Wings','Chicken Thigh','Boneless Chicken','Chicken Mince','Chicken Tikka','Chicken Sausage','Chicken Salami','Mutton Curry Cut','Mutton Keema','Mutton Chops','Mutton Boneless','Mutton Biryani Cut','Goat Meat','Lamb Chops','Pork Ribs','Pork Belly','Pork Sausage','Turkey Breast','Duck Meat','Rabbit Meat','Ham','Bacon'],
    sizes: [['250 g', 100, 280],['500 g', 180, 520],['1 kg', 340, 1000]],
    images: [
      'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400&q=80',
      'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=80',
    ],
  },
  'Fish & Seafood': {
    brands: ['Licious','FreshToHome','Captain Fresh','Fipola','Nutrich','Meatigo','Zappfresh','Freshwater','Tapper Fish','Ocean Basket','Khaogali','Chef\'s Basket','Blue Marlin','Coast To Coast','Malabar','Seafood Junction','Fresh Mart','Ruchi','Mumbai Fish','Kerala Fish','Bay of Bengal','Daily Fish','SSP','Zuari','Nash\'s'],
    bases: ['Rohu Fish','Katla Fish','Hilsa Fish','Pomfret Fish','Mackerel','Bangda','Tuna','Salmon','Sea Bass','Kingfish','Cat Fish','Red Snapper','Basa Fillet','Tilapia','Seer Fish','Rawas','Prawns','Tiger Prawns','Jumbo Prawns','Crab','Squid','Octopus','Sardines','Cuttlefish','Fish Fillet'],
    sizes: [['250 g', 120, 350],['500 g', 220, 680],['1 kg', 400, 1300]],
    images: [
      'https://images.unsplash.com/photo-1535596898139-e2c54ab81e8b?w=400&q=80',
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&q=80',
    ],
  },
  'Beauty & Makeup': {
    brands: ['Lakme','Maybelline','L\'Oreal','Nykaa','Colorbar','Elle 18','Revlon','Faces','MAC','Sugar','Mamaearth','Plum','The Body Shop','Biotique','Insight','Swiss Beauty','Wet n Wild','NYX','Essence','Huda Beauty','Anastasia','Too Faced','Benefit','Urban Decay','Tarte'],
    bases: ['Lipstick','Lip Gloss','Liquid Lipstick','Matte Lipstick','Eye Liner','Kajal','Mascara','Eye Shadow','Eye Brow Pencil','Compact Powder','Foundation','Concealer','BB Cream','CC Cream','Blush','Highlighter','Primer','Setting Spray','Makeup Remover','Nail Polish','Nail Polish Remover','Lip Liner','Contour','Bronzer','Eye Palette'],
    sizes: [['Each', 100, 450],['Set', 300, 1200],['Palette', 500, 2000]],
    images: [
      'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=400&q=80',
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80',
    ],
  },
  'Hair Care': {
    brands: ['Head & Shoulders','Pantene','Dove','Clinic Plus','Sunsilk','Tresemme','Parachute','Dabur','Patanjali','Biotique','Himalaya','Indulekha','Kesh King','Bajaj','Emami','Navratna','Matrix','Schwarzkopf','L\'Oreal','Garnier','Wella','Mamaearth','Khadi','Nyle','VLCC'],
    bases: ['Shampoo','Anti Dandruff Shampoo','Hair Fall Shampoo','Moisturizing Shampoo','Volume Shampoo','Conditioner','Deep Conditioner','Hair Oil','Coconut Oil','Almond Oil','Amla Oil','Bhringraj Oil','Hair Mask','Hair Serum','Hair Spray','Hair Gel','Hair Wax','Hair Cream','Hair Color','Hair Dye','Hair Tonic','Scalp Treatment','Dry Shampoo','Hair Pack','Leave In Conditioner'],
    sizes: [['100 ml', 60, 200],['200 ml', 110, 360],['400 ml', 200, 700]],
    images: [
      'https://images.unsplash.com/photo-1526045478516-99145907023c?w=400&q=80',
      'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&q=80',
    ],
  },
  'Oral Care': {
    brands: ['Colgate','Sensodyne','Pepsodent','Oral-B','Close-Up','Meswak','Dabur Red','Himalaya','Patanjali','Vicco','Dantkanti','Nomarks','Parodontax','Crest','Aquafresh','Listerine','Curasept','Glister','Himalaya Complete','Sansodyne','Babool','Neem','Anchor','Cibaca','Stolin'],
    bases: ['Toothpaste','Whitening Toothpaste','Herbal Toothpaste','Sensitive Toothpaste','Gel Toothpaste','Charcoal Toothpaste','Toothbrush','Electric Toothbrush','Kids Toothbrush','Mouthwash','Dental Floss','Teeth Whitener','Gum Care','Breath Freshener','Mouth Spray','Denture Cleaner','Tongue Cleaner','Oral Strips','Dental Pick','Orthodontic Wax','Fluoride Rinse','Mouth Ulcer Gel','Kids Toothpaste','Clove Toothpaste','Salt Toothpaste'],
    sizes: [['100 g', 30, 130],['200 g', 60, 250],['500 g', 130, 500]],
    images: [
      'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?w=400&q=80',
      'https://images.unsplash.com/photo-1612538498488-f42c79a9d1f8?w=400&q=80',
    ],
  },
  'Skin Care': {
    brands: ['Nivea','Pond\'s','Vaseline','Himalaya','Olay','Lakme','Plum','Mamaearth','The Body Shop','Biotique','Forest Essentials','Kama Ayurveda','Cetaphil','Neutrogena','Garnier','L\'Oreal','Dove','Johnson\'s','Fabindia','Patanjali','Dabur','Everyuth','Ustraa','Wow Skin','MCaffeine'],
    bases: ['Face Cream','Face Wash','Face Scrub','Face Serum','Face Mask','Sunscreen','Sun Block','Moisturizer','Cold Cream','Hand Cream','Body Lotion','Body Butter','Body Scrub','Shower Gel','Toner','Cleansing Milk','Makeup Remover','Anti Aging Cream','Wrinkle Cream','Fairness Cream','Night Cream','Day Cream','Eye Cream','Lip Balm','Foot Cream'],
    sizes: [['50 g', 70, 250],['100 g', 130, 450],['200 g', 230, 800]],
    images: [
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&q=80',
      'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=400&q=80',
    ],
  },
  "Men's Grooming": {
    brands: ['Gillette','Old Spice','Nivea Men','Axe','Park Avenue','Wildstone','Set Wet','Ustraa','The Man Company','Bombay Shaving Co.','Beardo','Denver','Fogg','Premium','L\'Oreal Men','Nivea','Dove Men','Adidas','Engage','Brylcreem','Emami Men','Himalaya Men','Vi-John','Garnier Men','Mamaearth Men'],
    bases: ['Shaving Cream','Shaving Foam','Shaving Gel','Razor','Disposable Razor','Cartridge Razor','Aftershave Lotion','Aftershave Balm','Beard Oil','Beard Wash','Beard Balm','Beard Cream','Face Wash for Men','Face Cream for Men','Body Wash for Men','Men Deodorant','Men Perfume','Men Shampoo','Hair Wax','Hair Gel','Hair Cream','Pomade','Trimmer Oil','Styling Gel','Moustache Wax'],
    sizes: [['50 g', 60, 200],['100 g', 120, 380],['200 g', 220, 700]],
    images: [
      'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&q=80',
      'https://images.unsplash.com/photo-1621605774672-6c53be1cde6e?w=400&q=80',
    ],
  },
  Deodorants: {
    brands: ['Axe','Fogg','Set Wet','Nivea','Park Avenue','Wildstone','Old Spice','Nike','Adidas','Denver','Envy','Yardley','Engage','Dove','Secret','Rexona','Degree','Dior','Calvin Klein','Burberry','Hugo Boss','Brut','Jovan','Playboy','Police'],
    bases: ['Deodorant Spray','Perfume Spray','Body Spray','Roll On Deo','Antiperspirant','Musk Deo','Floral Deo','Ocean Deo','Citrus Deo','Woody Deo','Sport Deo','Aqua Deo','Blossom Deo','Fresh Deo','Cool Deo','Intense Deo','Pure Deo','Natural Deo','Classic Deo','Silver Deo','Gold Deo','Black Deo','White Deo','Ice Deo','Storm Deo'],
    sizes: [['75 ml', 100, 280],['150 ml', 170, 500],['200 ml', 220, 700]],
    images: [
      'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&q=80',
      'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=400&q=80',
    ],
  },
  'Baby Care': {
    brands: ['Pampers','Huggies','MamyPoko','Johnson\'s','Mother Sparsh','Himalaya Baby','Mamaearth','The Moms Co.','R for Rabbit','Sebamed','Chicco','Dove Baby','Nivea Baby','Pigeon','Mee Mee','LuvLap','Libero','Supples','Teddyy','Babyhug','Wipro Baby','Bblunt Kids','BabyDove','Earth Rhythm','BabyChakra'],
    bases: ['Baby Diapers','Diaper Pants','Swim Pants','Training Pants','Baby Wipes','Gentle Wipes','Baby Soap','Baby Oil','Baby Powder','Baby Shampoo','Baby Lotion','Baby Cream','Diaper Rash Cream','Baby Shower Gel','Baby Bathtub','Baby Feeding Bottle','Baby Teether','Baby Spoon','Baby Napkins','Baby Mosquito Repellent','Kids Sunscreen','Kids Face Cream','Kids Toothpaste','Kids Shampoo','Kids Body Wash'],
    sizes: [['Pack of 10', 100, 300],['Pack of 30', 260, 750],['Pack of 60', 500, 1400]],
    images: [
      'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=400&q=80',
      'https://images.unsplash.com/photo-1544126592-807ade215a0b?w=400&q=80',
    ],
  },
  'Feminine Hygiene': {
    brands: ['Stayfree','Whisper','Sofy','Nine','Carefree','Niine','Bella','Sanfe','Everteen','Pee Safe','Azah','Rio','Paree','She','Libresse','Kotex','Tampax','Playtex','Natracare','Peesafe','Friends','Sirona','Swara','Organica','Nua'],
    bases: ['Sanitary Napkins','Ultra Thin Pads','Overnight Pads','Panty Liners','Tampons','Menstrual Cups','Intimate Wash','V-Wash','Period Pain Relief','Hygiene Wipes','Rash Free Pads','Cotton Pads','Organic Pads','Cloth Pads','Maternity Pads','Disposable Underwear','Period Panty','Intimate Cream','Bath Soap','Discharge Napkins','Heavy Flow Pads','Light Flow Pads','Reusable Pads','Gel Pads','Intimate Powder'],
    sizes: [['Pack of 7', 50, 180],['Pack of 15', 100, 340],['Pack of 30', 180, 650]],
    images: [
      'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=400&q=80',
      'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=400&q=80',
    ],
  },
  'Pet Food': {
    brands: ['Pedigree','Royal Canin','Whiskas','Purina','Drools','Farmina','Me-O','Hill\'s','Eukanuba','Acana','Orijen','Canidae','Chappie','Kennel Kitchen','Wiggles','Fumes','Henlo','Goofy Tails','Barkbutler','Meals for Mutts','Supreme','Mars','Taste of Wild','Boltz','Fidele'],
    bases: ['Adult Dog Food','Puppy Food','Senior Dog Food','Dry Dog Food','Wet Dog Food','Cat Food','Adult Cat Food','Kitten Food','Senior Cat Food','Dry Cat Food','Wet Cat Food','Fish Food','Bird Food','Rabbit Food','Hamster Food','Dog Treats','Cat Treats','Dog Biscuits','Cat Treats','Chicken Flavored','Beef Flavored','Fish Flavored','Vegetarian Pet Food','Grain Free','Prescription Diet'],
    sizes: [['500 g', 150, 450],['1 kg', 260, 800],['3 kg', 650, 2100]],
    images: [
      'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&q=80',
      'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&q=80',
    ],
  },
  Detergents: {
    brands: ['Surf Excel','Ariel','Tide','Rin','Wheel','Ghadi','Nirma','Henko','Sunlight','Patanjali','Genteel','Ezee','Fab','Active Wheel','Safed','Perfect','Chamko','555','Mr. White','Bonus','Easy','Washy','Chiku','Dura Wash','Nawab'],
    bases: ['Detergent Powder','Liquid Detergent','Detergent Bar','Top Load Powder','Front Load Powder','Matic Powder','Matic Liquid','Colored Clothes Powder','White Clothes Powder','Baby Detergent','Silk Detergent','Delicates Detergent','Heavy Soil Powder','Fabric Whitener','Liquid Blue','Starch','Fabric Softener','Fabric Conditioner','Ironing Spray','Stain Remover','Pre Wash','Bleach','Hand Wash Detergent','Bucket Wash','Bar Soap'],
    sizes: [['500 g', 40, 140],['1 kg', 75, 260],['3 kg', 200, 700]],
    images: [
      'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400&q=80',
      'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&q=80',
    ],
  },
  Dishwash: {
    brands: ['Vim','Pril','Exo','Dettol','Odopic','Power Plus','XTra','Joy','Patanjali','Godrej','Surf','Mr. White','Chandrika','Lifebuoy','Sanyo','Finish','Cif','Fairy','Dawn','Palmolive','Harmony','Swash','Sunlight','Lime Shine','Dish Clean'],
    bases: ['Dishwash Bar','Dishwash Liquid','Dishwash Gel','Dishwash Powder','Dish Soap','Dish Cleaner','Lime Dishwash','Lemon Dishwash','Anti Bacterial Dishwash','Ginger Dishwash','Herbal Dishwash','Dishwasher Tablet','Dishwasher Salt','Rinse Aid','Descaler','Dish Spray','Steel Polish','Kitchen Degreaser','Copper Cleaner','Brass Cleaner','Dish Cloth','Scrub Pad','Dish Scrubber','Cleaning Sponge','Steel Scrubber'],
    sizes: [['200 g', 25, 80],['500 ml', 60, 180],['1 L', 110, 330]],
    images: [
      'https://images.unsplash.com/photo-1600857062241-98ef96a7e3db?w=400&q=80',
      'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400&q=80',
    ],
  },
  'Floor & Toilet Care': {
    brands: ['Lizol','Harpic','Domex','Dettol','Mr. Muscle','Colin','Cif','Marine','Comet','Bleach','Clorox','Scrubbing Bubbles','Handy Andy','R1','R3','Magic','Eureka Forbes','Nimson','Easy','Cinthol','Vim Floor','Amway','BabyChakra','Prestige','Rainbow'],
    bases: ['Floor Cleaner','Toilet Cleaner','Bathroom Cleaner','Glass Cleaner','Tiles Cleaner','Multi Purpose Cleaner','Marble Cleaner','Disinfectant','Toilet Bowl Cleaner','Urinal Cleaner','Drain Cleaner','Toilet Freshener','Toilet Paper','Toilet Brush','Toilet Rolls','Bleaching Powder','Citronella Cleaner','Lemon Cleaner','Phenyl','Pine Disinfectant','Washroom Cleaner','Glass Wiper','Squeegee','Mop','Bucket'],
    sizes: [['500 ml', 50, 180],['1 L', 90, 330],['2 L', 160, 600]],
    images: [
      'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80',
      'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400&q=80',
    ],
  },
  'Pooja Needs': {
    brands: ['Cycle','Hem','Mangaldeep','Zed Black','Denim','Moksh','Pranaam','Aura','Parimal','Satya','Sugandh','Darshan','Shiva','Patanjali','Om','Shubh','Mystiq','Forest Essentials','Organic India','Naina','Chandan','Bhimseni','Gulab','Jagadamba','Raj'],
    bases: ['Agarbatti','Dhoop','Incense Sticks','Puja Thali','Camphor','Ghee Diya','Wick','Cotton Wicks','Roli','Kumkum','Chandan Powder','Sandalwood Paste','Haldi Kumkum','Gulal','Kalawa','Mauli','Gangajal','Rose Water','Kapoor','Haldi','Chawal','Janeu','Rudraksha','Akshat','Supari'],
    sizes: [['50 g', 20, 60],['100 g', 35, 120],['250 g', 70, 250]],
    images: [
      'https://images.unsplash.com/photo-1545048709-9fa36c1ad9a2?w=400&q=80',
      'https://images.unsplash.com/photo-1604608672516-f1b9b1d88e80?w=400&q=80',
    ],
  },
  'Kitchen Essentials': {
    brands: ['Milton','Cello','Tupperware','Prestige','Pigeon','Borosil','Butterfly','Signoraware','Solid','Dr. Oetker','Ankurwares','Maxel','Asian','Jaipan','Nakoda','Treo','Pearlpet','Steelo','Ganesh','Princeware','Varmora','Lion','Rotek','Wonderchef','Kitchen King'],
    bases: ['Casserole','Hot Case','Tiffin Box','Lunch Box','Water Bottle','Flask','Kitchen Knife','Chopping Board','Measuring Cup','Measuring Spoon','Mixing Bowl','Storage Container','Spice Rack','Dinner Set','Tea Set','Coffee Set','Glass Jar','Plastic Jar','Steel Plate','Bowl Set','Serving Tray','Kitchen Tongs','Ladle','Spatula','Strainer'],
    sizes: [['Small', 100, 350],['Medium', 200, 700],['Large', 400, 1500]],
    images: [
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80',
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400&q=80',
    ],
  },
  Stationery: {
    brands: ['Classmate','Natraj','Reynolds','Camlin','Apsara','Nataraj','Faber Castell','DOMS','Cello Pen','Parker','Pilot','Uniball','Linc','Staedtler','Luxor','Todd','Navneet','Sundaram','Sumo','Oddy','Standard','Hindustan','JK Paper','ITC','Maped'],
    bases: ['Notebook','Register','Exam Pad','Copy','Diary','Pen','Gel Pen','Ball Pen','Ink Pen','Sketch Pen','Pencil','Color Pencil','Eraser','Sharpener','Ruler','Glue Stick','Tape','Stapler','Pin Board','Marker','Highlighter','File','Folder','Envelope','Chart Paper'],
    sizes: [['Each', 10, 50],['Pack of 5', 40, 200],['Set', 100, 500]],
    images: [
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&q=80',
      'https://images.unsplash.com/photo-1583485088034-697b5bc36b92?w=400&q=80',
    ],
  },
  'Air Fresheners': {
    brands: ['Odonil','Ambi Pur','Godrej','Glade','Airwick','Lia','Iris','Involve','HEM','Odochem','Cycle','Natraj','Aroma Pro','SKY','Premium Scent','Fresh','Air Pro','Mangaldeep','Glamstar','ScenD','Homely','Wipro','Swish','Ecossentials','Ecosense'],
    bases: ['Room Spray','Car Freshener','Toilet Block','Plugin','Electric Air Freshener','Gel Freshener','Aerosol Spray','Bathroom Freshener','Gel Pack','Tablet Air Freshener','Reed Diffuser','Essential Oil Diffuser','Candle','Aroma Oil','Liquid Air Freshener','Solid Air Freshener','Fabric Spray','Pet Odor','Kitchen Odor','Smoke Remover','Natural Freshener','Floral Spray','Citrus Spray','Wood Spray','Herbal Spray'],
    sizes: [['50 g', 50, 150],['150 ml', 100, 320],['300 ml', 180, 600]],
    images: [
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&q=80',
      'https://images.unsplash.com/photo-1605217613423-0fb220a5a8ef?w=400&q=80',
    ],
  },
};

function buildVariants(category, idx) {
  const sizes = CATEGORY_DATA[category].sizes;
  const a = sizes[idx % sizes.length];
  const b = sizes[(idx + 1) % sizes.length];
  return [a, b].map(([label, lo, hi]) => {
    const mrp = lo + ((idx * 13) % (hi - lo + 1));
    const discount = 5 + (idx % 15); // 5-19%
    const sellingPrice = Math.max(1, Math.round((mrp * (100 - discount)) / 100));
    return { label, mrp, sellingPrice, isAvailable: true };
  });
}

async function run() {
  await connectDB();

  const cats = await GroceryCategory.find({ name: { $in: Object.keys(CATEGORY_DATA) } }).lean();
  if (cats.length !== Object.keys(CATEGORY_DATA).length) {
    throw new Error(`Expected ${Object.keys(CATEGORY_DATA).length} categories, found ${cats.length}. Run scripts/seed-grocery.js first.`);
  }
  const catByName = new Map(cats.map(c => [c.name, c._id]));

  const existingNames = new Set(
    (await GroceryProduct.find({}, { name: 1 }).lean()).map(p => p.name)
  );
  logger.info(`[bulk-seed] starting with ${existingNames.size} existing products`);

  const docs = [];

  for (const [catName, data] of Object.entries(CATEGORY_DATA)) {
    const catId = catByName.get(catName);
    let produced = 0;
    let idx = 0;

    outer: for (const base of data.bases) {
      for (const brand of data.brands) {
        if (produced >= PER_CATEGORY) break outer;
        const name = `${brand} ${base}`;
        if (existingNames.has(name)) { idx++; continue; }
        existingNames.add(name);
        docs.push({
          name,
          brand,
          description: `${base} by ${brand}.`,
          image: data.images[idx % data.images.length],
          category: catId,
          variants: buildVariants(catName, idx),
          isAvailable: true,
          tags: {
            isBestseller: idx % 23 === 0,
            isNew: idx % 37 === 0,
          },
        });
        produced++;
        idx++;
      }
    }
    logger.info(`[bulk-seed] ${catName}: prepared ${produced} new products`);
  }

  logger.info(`[bulk-seed] total new products to insert: ${docs.length}`);

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    const res = await GroceryProduct.insertMany(slice, { ordered: false });
    inserted += res.length;
    logger.info(`[bulk-seed] inserted ${inserted} / ${docs.length}`);
  }

  await mongoose.disconnect();
  logger.info(`[bulk-seed] done. Inserted ${inserted} products.`);
}

run().catch(err => {
  logger.error('[bulk-seed] FAILED:', err);
  process.exit(1);
});
