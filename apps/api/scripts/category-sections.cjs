'use strict';

// Rules apply ONLY inside the existing parent. Ambiguous names go to an explicit
// Other subsection for review, never to an unrelated department. First match wins.
const section = (name, pattern) => ({ name, pattern: new RegExp(pattern, 'i') });
const taxonomy = {
  'groceries': [section('Rice, Flour & Pulses', 'rice|flour|atta|lentil|daal|dal|chana'), section('Oil & Ghee', 'oil|ghee'), section('Sugar & Salt', 'sugar|salt'), section('Tea & Coffee', 'tea|coffee')],
  'milk-eggs-bread': [section('Cheese', 'cheese'), section('Yogurt & Raita', 'yogurt|yoghurt|raita|dahi'), section('Butter & Spreads', 'butter|margarine|spread'), section('Cream', 'cream'), section('Eggs', '\\beggs?\\b'), section('Bread & Bakery', 'bread|bun|rusk|toast|croissant'), section('Milk', 'milk|olper|olpers')],
  'fruits-vegetables': [section('Fresh Fruits', 'apple|apricot|banana|cherr|chiku|coconut|falsa|grape|jaman|aam|ambi|lasora|lemon|lychee|mango|melon|papaya|peach|plum|sugar cane|tamarind|avocado|amla|kiwi|orange|pomegranate|pineapple|strawberr|guava|pear'), section('Fresh Vegetables', 'arvi|aubergine|beetroot|gourd|cabbage|capsicum|cauliflower|carrot|coriander|corn|cucumber|fenugreek|bean|turmeric|garlic|pumpkin|ginger|chilli|onion|lettuce|lady finger|loki|kaddu|mint|peas|phaliya|potato|spinach|tinday|tomato|tori|turnip|kulfa|broccoli|mushroom|celery')],
  'snacks-drinks': [section('Biscuits & Cookies', 'biscuit|cookie|wafer|cracker'), section('Cakes & Sweet Snacks', 'cake|brownie|muffin|donut'), section('Chips & Savoury Snacks', 'chips|crisps|nimko|slanty|kurkure|cheetos|doritos|pringles|lays|lay.s|popcorn'), section('Chocolate & Candy', 'chocolate|candy|candies|toffee|gum|jellies|lollipop|marshmallow'), section('Drinks', 'drink|juice|cola|pepsi|fanta|7up|7 up|sprite|dew')],
  'bakery': [section('Bread & Naan', 'bread|naan|bun|rusk'), section('Cakes & Biscuits', 'cake|biscuit|cookie|pastry'), section('Savoury Bakery', 'patties|patty|pizza|sandwich')],
  'pharmacy': [section('Nutrition & Supplements', 'ensure|pediasure|glucose|glaxose|energile|vitamin|supplement'), section('First Aid & Hygiene', 'bandage|sanitiz|antiseptic|cotton|mask|thermometer'), section('Digestive & Herbal Care', 'ispaghol|joshanda|carmina|hamdard'), section('Personal Wellness', 'durex|condom|lubricant|lube')],
  'personal-care': [section('Oral Care', 'tooth|mouthwash|floss'), section('Deodorants & Fragrances', 'deodorant|body spray|perfume|roll.on|cologne'), section('Feminine Care', 'sanitary|pads|always|tampon'), section('Shaving & Grooming', 'razor|shav|gillette|blade'), section('Soap & Hand Care', 'soap|hand wash|handwash')],
  'baby-care': [section('Diapers & Wipes', 'diaper|napp|pampers|wipes|canbebe|molfix'), section('Baby Food & Formula', 'formula|similac|cerelac|lactogen|nan |nido|morinaga|aptamil|bebelac|s-26|meiji|bunyad|grow|milk|food'), section('Baby Bath & Skin Care', 'shampoo|oil|lotion|cream|powder|soap|bath|wash'), section('Baby Accessories', 'bottle|pacifier|brush|teether|gift')],
  'household': [section('Cleaning Tools', 'brush|wiper|broom|mop|sponge|duster'), section('Bags & Disposables', 'bag|disposable|tiffin|foil|cup|plate|spoon|fork|cling|wrap'), section('Batteries & Utilities', 'batter|bulb|match|candle'), section('Household Cleaning', 'clean|detergent|freshener|liquid|dishwash')],
  'stationery': [section('Pens, Pencils & Markers', 'pen|pencil|marker|highlighter'), section('Notebooks & Paper', 'notebook|register|copy|paper|pad|book'), section('Art & Craft', 'crayon|colour|color|paint|glue|balloon|craft'), section('Office Supplies', 'tape|stapl|eraser|sharpener|ruler|clip|scissor')],
  'mobile-accessories': [section('Cables & Chargers', 'cable|charger|adapter'), section('Power Banks', 'power bank'), section('Audio & Phone Accessories', 'earphone|headphone|earbud|case|cover|holder')],
  'pet-food': [section('Cat Food', 'cat|kitten|whiskas|me-o'), section('Dog Food', 'dog|puppy|pedigree'), section('Bird Food', 'bird|parrot')],
  'breakfast-essentials': [section('Cereals & Oats', 'cereal|oats|oatmeal|flakes|muesli|granola|chocos|weetabix'), section('Bread, Rusks & Buns', 'bread|rusk|bun|toast|croissant'), section('Jam, Honey & Spreads', 'jam|honey|marmalade|spread|butter|nutella'), section('Breakfast Cakes & Pancakes', 'cake|pancake|waffle|muffin|brownie|donut')],
  'daalain-rice-and-flour': [section('Rice', 'rice|basmati|sella'), section('Flour & Atta', 'flour|atta|besan|maida|suji|semolina|bajra'), section('Pulses & Beans', 'daal|dal|lentil|chana|lobia|bean|chickpea|moong|mash|masoor'), section('Sugar & Salt', 'sugar|cheeni|mishri|salt|gur|jaggery')],
  'oil-and-ghee': [section('Ghee & Banaspati', 'ghee|banaspati'), section('Olive Oil', 'olive'), section('Canola Oil', 'canola'), section('Sunflower Oil', 'sunflower'), section('Other Cooking Oils', 'oil')],
  'disposable-bags': [section('Recipe Masalas', 'masala|biryani|qorma|karahi|tikka|nihari|haleem|kabab|kofta|pulao|achar gosht|tandoori'), section('Ground Spices', 'powder|ground|crushed|pisi|pissa|pisa'), section('Herbs & Seasonings', 'oregano|basil|thyme|rosemary|parsley|seasoning|herb|kasuri|mint'), section('Whole Spices & Seeds', 'seed|whole|cumin|zeera|jeera|cardamom|elaichi|cinnamon|clove|pepper|chilli|chili|turmeric|coriander|fennel|saunf|kalonji|bay leaf|anise|ajwain|fenugreek|nutmeg|mace|saffron|darchini|dhania')],
  'sauces-olives-and-pickles': [section('Pickles & Olives', 'pickle|achar|olive'), section('Mayonnaise & Dressings', 'mayonnaise|mayo|dressing|mustard'), section('Cooking Pastes', 'paste|puree'), section('Vinegar', 'vinegar'), section('Ketchup & Sauces', 'ketchup|sauce|chutney|salsa')],
  'baking-and-desserts': [section('Pasta & Noodles', 'pasta|noodle|macaroni|spaghetti|vermicelli|lasagn|fettucc|penne|fusilli|sawai'), section('Dessert Mixes', 'custard|jelly|pudding|kheer|firni|falooda|dessert|cake mix|brownie mix'), section('Baking Ingredients', 'baking|yeast|cocoa|chocolate|icing|essence|vanilla|corn flour|cornflour|gelatin|coconut|sprinkle|colour|color')],
  'dry-fruit-and-nuts': [section('Dates & Dried Fruit', 'date|raisin|kishmish|alu bhukara|prune|apricot|fig|tamarind'), section('Nuts', 'nut|almond|badam|pista|pistachio|cashew|kaju|chalgoza|chilgoza|peanut'), section('Seeds & Makhana', 'seed|makhana|maiva|coconut')],
  'frozen-and-chilled': [section('Paratha, Roti & Wraps', 'paratha|roti|naan|wrap'), section('Samosas & Rolls', 'samosa|roll|spring'), section('Kabab, Kofta & Patties', 'kabab|kebab|kofta|patty|patties|burger'), section('Nuggets & Chicken Snacks', 'nugget|chicken|boti|strip|chunk|wing|tender'), section('Frozen Seafood', 'fish|shrimp|prawn'), section('Frozen Vegetables', 'vegetable|peas|corn|spinach|fries|potato')],
  'beverages': [section('Tea & Coffee', 'tea|coffee|nescafe|cappuccino'), section('Water', '\\bwater\\b|aquafina'), section('Juices & Fruit Drinks', 'juice|nectar|fruit|mango|apple|orange|guava|froot|shezan|slice'), section('Energy & Sports Drinks', 'energy|red bull|sting|gatorade|powerade'), section('Soft Drinks', 'cola|pepsi|7up|7 up|sprite|fanta|mirinda|dew|carbonated')],
  'fresh-meat': [section('Seafood', 'fish|shrimp|prawn|salmon|tuna|crab'), section('Chicken', 'chicken'), section('Beef', 'beef'), section('Mutton', 'mutton|lamb|goat')],
  'bath-body-hair': [section('Conditioner & Hair Treatments', 'conditioner|hair mask|treatment'), section('Shampoo', 'shampoo'), section('Hair Oil', 'oil'), section('Soap & Hand Wash', 'soap|handwash|hand wash'), section('Body Wash & Shower Gel', 'body wash|bodywash|shower|bath')],
  'skin-care': [section('Face Wash & Cleansers', 'face wash|facewash|cleanser|scrub|wipes'), section('Creams, Lotions & Serums', 'cream|lotion|serum|moisturi|vaseline'), section('Sunscreen', 'sun|spf'), section('Talc & Powders', 'talc|powder')],
  'home-care': [section('Insect Repellents', 'insect|mosquito|cockroach|repellent|mortein|finis|kingtox|baygon'), section('Bathroom & Toilet Cleaners', 'toilet|bathroom|harpic'), section('Dishwashing', 'dish|lemon max'), section('Surface & Floor Cleaners', 'cleaner|phenyl|floor|glass|surface|bleach'), section('Tissues & Kitchen Wraps', 'tissue|napkin|towel|foil|wrap|paper')],
  'fabric-care': [section('Fabric Conditioners', 'conditioner|softener|comfort'), section('Stain Removers & Bleach', 'stain|bleach|vanish'), section('Laundry Detergents', 'detergent|surf|ariel|brite|bonus|sufi|express|powder|washing')],
};
// Additional spellings/product families observed in the public catalogue. Keep
// these parent-scoped: a flavour word must not move juice into Fresh Fruits.
function extend(parent, name, pattern) {
  const rule = taxonomy[parent].find(item => item.name === name);
  if (!rule) throw new Error(`Unknown subsection: ${parent}/${name}`);
  rule.pattern = new RegExp(`${rule.pattern.source}|${pattern}`, 'i');
}
extend('milk-eggs-bread', 'Milk', 'whitener|vitacals|everyday');
extend('milk-eggs-bread', 'Yogurt & Raita', 'laban');
extend('snacks-drinks', 'Biscuits & Cookies', 'bisconni|cocomo|oreo|\\blu tuc\\b|wheatable|zeera plus|peek freans|gala egg|prince choco');
extend('snacks-drinks', 'Chips & Savoury Snacks', 'cheeetos|nimco|nachos|super crisp|snackers|papad|pakoriyan|gol gappay');
extend('snacks-drinks', 'Chocolate & Candy', 'cadbury|spout spearmint|sweet fennel');
extend('snacks-drinks', 'Drinks', 'water');
taxonomy['snacks-drinks'].push(section('Instant Noodles', 'noodle|noddle'));
extend('pharmacy', 'Nutrition & Supplements', 'ovaltine|pedia sure|nutrition');
extend('pharmacy', 'First Aid & Hygiene', 'saniplast');
extend('pharmacy', 'Digestive & Herbal Care', 'marhaba|qarshi');
taxonomy.pharmacy.push(section('Medicines & Rehydration', 'paracetamol|\\bors\\b'));
extend('personal-care', 'Oral Care', 'oral-b|colgate|close up');
extend('personal-care', 'Feminine Care', 'butterfly|molpad|molped|embrace|sensitives maxi|essentials maxi|mother comfort');
extend('personal-care', 'Deodorants & Fragrances', 'anti-perspirant|rexona|nivea black|nivea men invisible|dove go fresh');
extend('personal-care', 'Shaving & Grooming', 'venus breeze|tec ii|razer');
taxonomy['personal-care'].push(section('Shoe Care', 'shoe|cherry blossom|cherry paste|power plus.*shine'), section('Hair Care', 'shampoo'));
extend('baby-care', 'Baby Food & Formula', 'loctogen');
extend('baby-care', 'Baby Bath & Skin Care', 'cologne|jelly');
extend('baby-care', 'Baby Accessories', 'feeder|cup|scissor|toothpaste');
extend('household', 'Cleaning Tools', 'dust pan|toilet pump|micro fiber');
extend('household', 'Batteries & Utilities', 'cells|energizer');
extend('household', 'Household Cleaning', 'fresher');
extend('stationery', 'Pens, Pencils & Markers', 'ball point');
extend('stationery', 'Notebooks & Paper', 'envelope|sticky notes');
extend('stationery', 'Art & Craft', 'sticker|rubiks|flupa');
extend('stationery', 'Office Supplies', 'erasor|ink remover');
extend('breakfast-essentials', 'Cereals & Oats', 'daliya|porridge|mingalz|fauji choco|frootooz|koco balls|koko crunch');
extend('breakfast-essentials', 'Bread, Rusks & Buns', 'tortilla|roti|crumbs|baqar|baqarkhani|french heart');
extend('breakfast-essentials', 'Jam, Honey & Spreads', 'syrup|jelly|marmlade|topping');
taxonomy['breakfast-essentials'].push(section('Eggs', '\\beggs?\\b'));
extend('daalain-rice-and-flour', 'Flour & Atta', 'baisin');
extend('daalain-rice-and-flour', 'Pulses & Beans', 'maash|mung');
extend('daalain-rice-and-flour', 'Sugar & Salt', 'misri|shakar|stevia|sweetner');
extend('disposable-bags', 'Recipe Masalas', 'mix|masla|tenderizer|korma|jalfrezi|murghi|paaya');
extend('disposable-bags', 'Herbs & Seasonings', 'qasuri|tarragon|five spice');
extend('disposable-bags', 'Whole Spices & Seeds', 'khashkhash|khashkash|badiyaan|ellaichi|imli|jaifal|javatri|methi|mirch|sagodana|tatri|tukh|jalwatri|kalwanji|maithray|alsi|tez path');
extend('sauces-olives-and-pickles', 'Ketchup & Sauces', 'peri peri');
extend('sauces-olives-and-pickles', 'Cooking Pastes', 'tomato pure');
extend('baking-and-desserts', 'Pasta & Noodles', 'macroni|spagetti|manchurian|kolson.*(dhanak|elbow|shell|spiral)');
extend('baking-and-desserts', 'Dessert Mixes', 'kulfa|tukr|dullari|gulab jaman');
extend('baking-and-desserts', 'Baking Ingredients', 'vanila|coating|meetha soda|zarda rang|coca powder|essense|bread improver|choco bliss');
taxonomy['baking-and-desserts'].push(section('Soups & Stock', 'soup|stock|stok|chicken cube|chicken powder'), section('Canned & Jarred Foods', 'olive|oilve|corn|cucumber|cocktail|jalapeno|mushroom|bean|chick peas|saag'));
extend('beverages', 'Tea & Coffee', 'latte|cappuccion|tapal|brooke bond|lipton|chai');
taxonomy.beverages.push(section('Syrups, Squashes & Malt Drinks', 'qarshi|marhaba|squash|sharbat|rooh afza|milo|ovaltine'));
extend('beverages', 'Soft Drinks', 'sufi laman|sufi manta');
extend('frozen-and-chilled', 'Paratha, Roti & Wraps', 'chappati|chapati|sheermal|taftan|puff pastry');
extend('frozen-and-chilled', 'Nuggets & Chicken Snacks', 'fillet|blazin|fiery fingers|pizzetta|toppingz');
extend('frozen-and-chilled', 'Frozen Vegetables', 'hash brown');
taxonomy['frozen-and-chilled'].push(section('Sausages & Prepared Meats', 'sausage|franks|meat loaf|beef paprika'), section('Frozen Fruits', 'blueberr|strawberr|fruits of the forest'));
extend('home-care', 'Insect Repellents', 'inseguard|fast kill|power plus refill');
extend('home-care', 'Bathroom & Toilet Cleaners', 'domestos');
extend('home-care', 'Dishwashing', 'vim bar');
extend('home-care', 'Tissues & Kitchen Wraps', 'xtra kleen|xtra clean|sateen|rose petal|daster khawan');
extend('home-care', 'Surface & Floor Cleaners', 'green shield|pledge|kiwi|polish');
taxonomy['home-care'].push(section('Cleaning Tools & Gloves', 'roller|spiral|glove|nail saver|scrub|scour|spontex'));
extend('fabric-care', 'Laundry Detergents', 'sunlight');
taxonomy['fabric-care'].push(section('Laundry Blue & Starch', 'liquid blue|blue liquid|starch|neel'));
extend('bath-body-hair', 'Conditioner & Hair Treatments', 'serum|styling|hair color|color silk|hair spray|heat protection|spiking wax|killi wax');
extend('bath-body-hair', 'Shampoo', 'shampo|head & shoulder');
extend('bath-body-hair', 'Soap & Hand Wash', 'lifebuoy.*(gel|refill|trio)|palmolive naturals');
extend('skin-care', 'Face Wash & Cleansers', 'clearing foam');
extend('skin-care', 'Creams, Lotions & Serums', 'ponds|glow & lovely');
extend('personal-care', 'Shoe Care', 'cherryblosom|kiwi');
extend('personal-care', 'Shaving & Grooming', 'treet femina|venus smooth');
taxonomy['personal-care'].push(section('Hair Removal', 'veet|hair removal|hair remover|wax strips'), section('Body & Skin Care', 'prickly heat'));
extend('oil-and-ghee', 'Other Cooking Oils', 'olivola');
extend('sauces-olives-and-pickles', 'Ketchup & Sauces', 'shangrila trio');
taxonomy['sauces-olives-and-pickles'].push(section('Lemon Juice', 'lemon juice'));
// Specific product types take precedence over ingredient/flavour words.
for (const [parent, name] of [['skin-care', 'Sunscreen'], ['frozen-and-chilled', 'Sausages & Prepared Meats'], ['daalain-rice-and-flour', 'Flour & Atta']]) {
  const index = taxonomy[parent].findIndex(rule => rule.name === name);
  taxonomy[parent].unshift(...taxonomy[parent].splice(index, 1));
}
const slugify = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function definitions(parent) {
  const rules = taxonomy[parent.slug];
  if (!rules) return [];
  return [...rules, { name: `Other ${parent.name}`, pattern: null }].map((rule, index) => ({
    ...rule, slug: `${parent.slug}--${slugify(rule.name)}`, sortOrder: index,
  }));
}
function classify(parent, name) {
  return definitions(parent).find(rule => rule.pattern === null || rule.pattern.test(name));
}
module.exports = { taxonomy, definitions, classify };
