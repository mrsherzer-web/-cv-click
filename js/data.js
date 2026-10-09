// קטלוג רכיבים ומאגר מתכונים מקומי.
// כל רכיב: id, שם, אימוג'י, קטגוריה, כמה ימים בערך מחזיק במקרר, וכינויים לזיהוי.

export const CATEGORIES = {
  dairy: { label: 'חלב וגבינות', emoji: '🧀' },
  protein: { label: 'חלבונים', emoji: '🥚' },
  veg: { label: 'ירקות', emoji: '🥬' },
  fruit: { label: 'פירות', emoji: '🍎' },
  carbs: { label: 'פחמימות', emoji: '🍞' },
  sauces: { label: 'רטבים ותבלינים', emoji: '🫙' },
  other: { label: 'אחר', emoji: '🧺' },
};

export const INGREDIENTS = [
  { id: 'eggs', name: 'ביצים', emoji: '🥚', cat: 'protein', shelf: 21, aliases: ['ביצה', 'egg', 'eggs'] },
  { id: 'white_cheese', name: 'גבינה לבנה', emoji: '🧀', cat: 'dairy', shelf: 7, aliases: ['גבינה לבנה', 'קוטג׳', 'קוטג', 'cottage', 'cream cheese', 'white cheese', 'quark'] },
  { id: 'yellow_cheese', name: 'גבינה צהובה', emoji: '🧀', cat: 'dairy', shelf: 20, aliases: ['גבינה צהובה', 'עמק', 'מוצרלה', 'צ׳דר', 'cheddar', 'mozzarella', 'yellow cheese', 'cheese'] },
  { id: 'feta', name: 'בולגרית / פטה', emoji: '🧀', cat: 'dairy', shelf: 14, aliases: ['בולגרית', 'פטה', 'feta', 'צפתית'] },
  { id: 'parmesan', name: 'פרמזן', emoji: '🧀', cat: 'dairy', shelf: 30, aliases: ['פרמזן', 'parmesan'] },
  { id: 'milk', name: 'חלב', emoji: '🥛', cat: 'dairy', shelf: 6, aliases: ['חלב', 'milk'] },
  { id: 'yogurt', name: 'יוגורט', emoji: '🥣', cat: 'dairy', shelf: 10, aliases: ['יוגורט', 'yogurt', 'יופלה', 'לבן'] },
  { id: 'butter', name: 'חמאה', emoji: '🧈', cat: 'dairy', shelf: 30, aliases: ['חמאה', 'butter'] },
  { id: 'cream', name: 'שמנת מתוקה', emoji: '🥛', cat: 'dairy', shelf: 7, aliases: ['שמנת', 'cream'] },
  { id: 'tomato', name: 'עגבניות', emoji: '🍅', cat: 'veg', shelf: 5, aliases: ['עגבניה', 'עגבנייה', 'עגבניות', 'עגבניות שרי', 'tomato', 'tomatoes'] },
  { id: 'cucumber', name: 'מלפפונים', emoji: '🥒', cat: 'veg', shelf: 6, aliases: ['מלפפון', 'מלפפונים', 'cucumber'] },
  { id: 'onion', name: 'בצל', emoji: '🧅', cat: 'veg', shelf: 30, aliases: ['בצל', 'onion', 'בצל סגול'] },
  { id: 'garlic', name: 'שום', emoji: '🧄', cat: 'veg', shelf: 30, aliases: ['שום', 'garlic'] },
  { id: 'pepper', name: 'פלפל', emoji: '🫑', cat: 'veg', shelf: 7, aliases: ['פלפל', 'פלפל אדום', 'גמבה', 'bell pepper', 'pepper'] },
  { id: 'zucchini', name: 'קישואים', emoji: '🥒', cat: 'veg', shelf: 7, aliases: ['קישוא', 'קישואים', 'zucchini'] },
  { id: 'carrot', name: 'גזר', emoji: '🥕', cat: 'veg', shelf: 21, aliases: ['גזר', 'carrot'] },
  { id: 'potato', name: 'תפוחי אדמה', emoji: '🥔', cat: 'veg', shelf: 30, aliases: ['תפוח אדמה', 'תפוחי אדמה', 'potato'] },
  { id: 'spinach', name: 'תרד / עלים', emoji: '🥬', cat: 'veg', shelf: 4, aliases: ['תרד', 'עלי בייבי', 'חסה', 'spinach', 'lettuce', 'greens'] },
  { id: 'mushrooms', name: 'פטריות', emoji: '🍄', cat: 'veg', shelf: 5, aliases: ['פטריות', 'שמפיניון', 'mushroom', 'mushrooms'] },
  { id: 'herbs', name: 'עשבי תיבול', emoji: '🌿', cat: 'veg', shelf: 5, aliases: ['פטרוזיליה', 'כוסברה', 'בזיליקום', 'שמיר', 'נענע', 'herbs', 'parsley', 'basil'] },
  { id: 'green_onion', name: 'בצל ירוק', emoji: '🌱', cat: 'veg', shelf: 6, aliases: ['בצל ירוק', 'scallion', 'green onion'] },
  { id: 'lemon', name: 'לימון', emoji: '🍋', cat: 'fruit', shelf: 21, aliases: ['לימון', 'lemon'] },
  { id: 'banana', name: 'בננות', emoji: '🍌', cat: 'fruit', shelf: 5, aliases: ['בננה', 'בננות', 'banana'] },
  { id: 'apple', name: 'תפוחים', emoji: '🍎', cat: 'fruit', shelf: 21, aliases: ['תפוח', 'תפוחים', 'apple'] },
  { id: 'avocado', name: 'אבוקדו', emoji: '🥑', cat: 'fruit', shelf: 4, aliases: ['אבוקדו', 'avocado'] },
  { id: 'chicken', name: 'חזה עוף', emoji: '🍗', cat: 'protein', shelf: 2, aliases: ['עוף', 'חזה עוף', 'פרגית', 'שניצל', 'chicken'] },
  { id: 'tuna', name: 'טונה', emoji: '🐟', cat: 'protein', shelf: 365, aliases: ['טונה', 'tuna'] },
  { id: 'tofu', name: 'טופו', emoji: '🧊', cat: 'protein', shelf: 10, aliases: ['טופו', 'tofu'] },
  { id: 'chickpeas', name: 'חומוס (גרגרים)', emoji: '🫘', cat: 'protein', shelf: 365, aliases: ['גרגרי חומוס', 'חומוס בקופסה', 'chickpeas'] },
  { id: 'hummus', name: 'חומוס (ממרח)', emoji: '🥙', cat: 'sauces', shelf: 6, aliases: ['חומוס', 'ממרח חומוס', 'hummus'] },
  { id: 'tahini', name: 'טחינה', emoji: '🥣', cat: 'sauces', shelf: 60, aliases: ['טחינה', 'tahini'] },
  { id: 'bread', name: 'לחם', emoji: '🍞', cat: 'carbs', shelf: 4, aliases: ['לחם', 'פרוסות', 'פיתה', 'פיתות', 'bread', 'pita'] },
  { id: 'tortilla', name: 'טורטיות', emoji: '🫓', cat: 'carbs', shelf: 14, aliases: ['טורטיה', 'טורטייה', 'טורטיות', 'לאפה', 'tortilla', 'wrap'] },
  { id: 'pasta', name: 'פסטה', emoji: '🍝', cat: 'carbs', shelf: 365, aliases: ['פסטה', 'ספגטי', 'פנה', 'pasta', 'spaghetti'] },
  { id: 'rice', name: 'אורז', emoji: '🍚', cat: 'carbs', shelf: 365, aliases: ['אורז', 'אורז מבושל', 'rice'] },
  { id: 'noodles', name: 'נודלס', emoji: '🍜', cat: 'carbs', shelf: 365, aliases: ['נודלס', 'אטריות', 'noodles', 'ramen'] },
  { id: 'oats', name: 'שיבולת שועל', emoji: '🌾', cat: 'carbs', shelf: 365, aliases: ['שיבולת שועל', 'קוואקר', 'oats', 'granola', 'גרנולה'] },
  { id: 'soy_sauce', name: 'רוטב סויה', emoji: '🫙', cat: 'sauces', shelf: 365, aliases: ['סויה', 'רוטב סויה', 'soy sauce', 'soy'] },
  { id: 'tomato_sauce', name: 'רסק / רוטב עגבניות', emoji: '🥫', cat: 'sauces', shelf: 10, aliases: ['רסק', 'רסק עגבניות', 'רוטב עגבניות', 'פסטה רוסו', 'tomato sauce', 'passata'] },
  { id: 'honey', name: 'דבש', emoji: '🍯', cat: 'sauces', shelf: 365, aliases: ['דבש', 'honey', 'סילאן'] },
  { id: 'mayo', name: 'מיונז', emoji: '🫙', cat: 'sauces', shelf: 60, aliases: ['מיונז', 'mayo', 'mayonnaise'] },
  { id: 'pesto', name: 'פסטו', emoji: '🌿', cat: 'sauces', shelf: 14, aliases: ['פסטו', 'pesto'] },
  { id: 'peanut_butter', name: 'חמאת בוטנים', emoji: '🥜', cat: 'sauces', shelf: 120, aliases: ['חמאת בוטנים', 'peanut butter'] },
  { id: 'corn', name: 'תירס', emoji: '🌽', cat: 'veg', shelf: 365, aliases: ['תירס', 'corn'] },
  { id: 'olives', name: 'זיתים', emoji: '🫒', cat: 'other', shelf: 60, aliases: ['זיתים', 'olives'] },
  { id: 'frozen_veg', name: 'ירקות קפואים', emoji: '🧊', cat: 'veg', shelf: 180, aliases: ['ירקות קפואים', 'אפונה', 'שעועית ירוקה', 'frozen vegetables', 'peas'] },
];

// מוצרי יסוד שכמעט בכל בית יש – לא נחשבים "חסרים"
export const STAPLES = ['שמן', 'מלח', 'פלפל שחור', 'מים', 'סוכר', 'קמח', 'פפריקה', 'כמון'];

export const DIETS = [
  { id: 'vegetarian', label: 'צמחוני', emoji: '🥗' },
  { id: 'vegan', label: 'טבעוני', emoji: '🌱' },
  { id: 'highProtein', label: 'חלבון גבוה', emoji: '💪' },
  { id: 'keto', label: 'קטו / דל פחמימה', emoji: '🥑' },
  { id: 'glutenFree', label: 'ללא גלוטן', emoji: '🚫🌾' },
];

export const ALLERGENS = [
  { id: 'dairy', label: 'חלב' },
  { id: 'egg', label: 'ביצים' },
  { id: 'gluten', label: 'גלוטן' },
  { id: 'soy', label: 'סויה' },
  { id: 'nuts', label: 'אגוזים / בוטנים' },
  { id: 'sesame', label: 'שומשום' },
  { id: 'fish', label: 'דגים' },
];

export const CUISINES = {
  israeli: 'ישראלי',
  italian: 'איטלקי',
  asian: 'אסייתי',
  mexican: 'מקסיקני',
  breakfast: 'ארוחת בוקר',
  comfort: 'אוכל מנחם',
};

// pans: כמה כלים צריך לשטוף (0 = כמעט כלום)
export const RECIPES = [
  {
    id: 'shakshuka', title: 'שקשוקה של 12 דקות', emoji: '🍳', cuisine: 'israeli', time: 12, pans: 1,
    calories: 340, protein: 19, diets: ['vegetarian', 'glutenFree', 'keto'], allergens: ['egg'],
    ingredients: [
      { id: 'eggs', qty: '3 ביצים' }, { id: 'tomato', qty: '2-3 עגבניות' },
      { id: 'onion', qty: '½ בצל', optional: true }, { id: 'pepper', qty: '½ פלפל', optional: true },
      { id: 'garlic', qty: '2 שיני שום', optional: true }, { id: 'tomato_sauce', qty: '2 כפות רסק', optional: true },
      { id: 'feta', qty: 'קצת בולגרית לפיזור', optional: true },
    ],
    steps: [
      'מחממים כף שמן במחבת. אם יש בצל/פלפל – קוצצים ומטגנים 3 דקות.',
      'מוסיפים עגבניות קצוצות (ורסק אם יש), מלח, פפריקה וכמון. מבשלים 5 דקות עד שמתרכך.',
      'פותחים 3 גומות ושוברים לתוכן את הביצים. מכסים ומבשלים 4 דקות.',
      'מפזרים בולגרית/עשבי תיבול ומגישים עם לחם ישר מהמחבת.',
    ],
  },
  {
    id: 'soy_egg_rice', title: 'אורז מוקפץ עם ביצה וסויה', emoji: '🍚', cuisine: 'asian', time: 10, pans: 1,
    calories: 480, protein: 17, diets: ['vegetarian'], allergens: ['egg', 'soy', 'gluten'],
    ingredients: [
      { id: 'rice', qty: '1½ כוס אורז מבושל (עדיף מאתמול)' }, { id: 'eggs', qty: '2 ביצים' },
      { id: 'soy_sauce', qty: '2 כפות סויה' }, { id: 'green_onion', qty: 'בצל ירוק', optional: true },
      { id: 'frozen_veg', qty: 'חופן ירקות קפואים', optional: true }, { id: 'garlic', qty: 'שן שום', optional: true },
      { id: 'carrot', qty: '½ גזר מגורד', optional: true },
    ],
    steps: [
      'מחממים שמן במחבת/ווק על אש גבוהה. מקפיצים שום וירקות 2 דקות.',
      'מוסיפים את האורז ומקפיצים 3 דקות עד שמתחיל להשחים.',
      'דוחפים לצד, שוברים ביצים, מקשקשים ומערבבים עם האורז.',
      'מוסיפים סויה, מערבבים ומסיימים בבצל ירוק.',
    ],
  },
  {
    id: 'tomato_eggs', title: 'ביצים ועגבניות בסגנון סיני', emoji: '🥚', cuisine: 'asian', time: 8, pans: 1,
    calories: 290, protein: 18, diets: ['vegetarian', 'glutenFree', 'keto'], allergens: ['egg', 'soy'],
    ingredients: [
      { id: 'eggs', qty: '3 ביצים' }, { id: 'tomato', qty: '2 עגבניות "עייפות"' },
      { id: 'soy_sauce', qty: '1 כף סויה', optional: true }, { id: 'green_onion', qty: 'בצל ירוק', optional: true },
      { id: 'rice', qty: 'אורז להגשה', optional: true },
    ],
    steps: [
      'מקשקשים את הביצים עם קורט מלח, מטגנים עד שכמעט נקרשות ומוציאים לצלחת.',
      'באותה מחבת מטגנים את העגבניות פרוסות לפלחים 3 דקות עד שמשחררות נוזלים.',
      'מוסיפים סויה וקורט סוכר, מחזירים את הביצים ומערבבים בעדינות.',
      'מגישים מעל אורז או לבד. זה המתכון המושלם לעגבניות שכבר לא יפות לסלט.',
    ],
  },
  {
    id: 'cheese_omelette', title: 'חביתה עשירה עם גבינה לבנה', emoji: '🍳', cuisine: 'breakfast', time: 6, pans: 1,
    calories: 310, protein: 24, diets: ['vegetarian', 'glutenFree', 'keto', 'highProtein'], allergens: ['egg', 'dairy'],
    ingredients: [
      { id: 'eggs', qty: '3 ביצים' }, { id: 'white_cheese', qty: '2 כפות גבינה לבנה' },
      { id: 'herbs', qty: 'עשבי תיבול', optional: true }, { id: 'tomato', qty: 'עגבנייה לצד', optional: true },
    ],
    steps: [
      'טורפים ביצים עם מלח ופלפל.',
      'יוצקים למחבת חמה משומנת, ומנמיכים לאש בינונית.',
      'כשהחביתה כמעט נקרשת – מורחים גבינה לבנה על חצי, מקפלים.',
      'דקה נוספת עם מכסה. מגישים עם עגבנייה פרוסה.',
    ],
  },
  {
    id: 'pasta_pomodoro', title: 'פסטה פומודורו מהירה', emoji: '🍝', cuisine: 'italian', time: 15, pans: 2,
    calories: 520, protein: 16, diets: ['vegetarian', 'vegan'], allergens: ['gluten'],
    ingredients: [
      { id: 'pasta', qty: '200 גרם פסטה' }, { id: 'tomato', qty: '3 עגבניות', alt: 'tomato_sauce' },
      { id: 'garlic', qty: '3 שיני שום', optional: true }, { id: 'herbs', qty: 'בזיליקום', optional: true },
      { id: 'parmesan', qty: 'פרמזן לגירוד', optional: true },
    ],
    steps: [
      'מבשלים פסטה במים רותחים ומלוחים לפי ההוראות.',
      'במקביל: שום פרוס בשמן זית 1 דקה, מוסיפים עגבניות מגוררות/רסק, מלח, ומבשלים 8 דקות.',
      'מעבירים את הפסטה ישר לרוטב עם חצי כוס ממי הבישול ומערבבים דקה.',
      'מסיימים בבזיליקום ופרמזן.',
    ],
  },
  {
    id: 'aglio_olio', title: 'ספגטי אליו אוליו', emoji: '🍝', cuisine: 'italian', time: 12, pans: 2,
    calories: 480, protein: 13, diets: ['vegetarian', 'vegan'], allergens: ['gluten'],
    ingredients: [
      { id: 'pasta', qty: '200 גרם ספגטי' }, { id: 'garlic', qty: '4 שיני שום' },
      { id: 'herbs', qty: 'פטרוזיליה', optional: true }, { id: 'parmesan', qty: 'פרמזן', optional: true },
      { id: 'lemon', qty: 'גרידת לימון', optional: true },
    ],
    steps: [
      'מבשלים ספגטי במים מלוחים.',
      'פורסים שום דק ומחממים ב-4 כפות שמן זית על אש נמוכה עד הזהבה עדינה. מוסיפים צ׳ילי אם יש.',
      'מעבירים את הפסטה עם רבע כוס מי בישול לשמן, מערבבים נמרצות עד שנוצר רוטב.',
      'פטרוזיליה, גרידת לימון ופרמזן – ומגישים.',
    ],
  },
  {
    id: 'pesto_pasta', title: 'פסטה פסטו בסיר אחד', emoji: '🌿', cuisine: 'italian', time: 12, pans: 1,
    calories: 560, protein: 17, diets: ['vegetarian'], allergens: ['gluten', 'dairy', 'nuts'],
    ingredients: [
      { id: 'pasta', qty: '200 גרם פסטה' }, { id: 'pesto', qty: '3 כפות פסטו' },
      { id: 'tomato', qty: 'עגבניות שרי', optional: true }, { id: 'parmesan', qty: 'פרמזן', optional: true },
    ],
    steps: [
      'מבשלים פסטה. שומרים כוס ממי הבישול ומסננים.',
      'מחזירים לאותו סיר, מוסיפים פסטו ומעט מי בישול ומערבבים.',
      'מוסיפים עגבניות חצויות ופרמזן. סיר אחד, אפס כאב ראש.',
    ],
  },
  {
    id: 'israeli_salad_eggs', title: 'סלט קצוץ עם ביצה קשה וטחינה', emoji: '🥗', cuisine: 'israeli', time: 10, pans: 1,
    calories: 330, protein: 15, diets: ['vegetarian', 'glutenFree', 'keto'], allergens: ['egg', 'sesame'],
    ingredients: [
      { id: 'tomato', qty: '2 עגבניות' }, { id: 'cucumber', qty: '2 מלפפונים' },
      { id: 'eggs', qty: '2 ביצים', optional: true }, { id: 'tahini', qty: 'טחינה', optional: true },
      { id: 'lemon', qty: '½ לימון', optional: true }, { id: 'onion', qty: '¼ בצל', optional: true },
      { id: 'herbs', qty: 'פטרוזיליה', optional: true },
    ],
    steps: [
      'מרתיחים ביצים 9 דקות (אם רוצים חלבון).',
      'בינתיים קוצצים דק עגבניות, מלפפונים ובצל.',
      'מתבלים בשמן זית, לימון, מלח ופלפל.',
      'מגישים עם ביצה פרוסה וטחינה מעל.',
    ],
  },
  {
    id: 'cheese_toast', title: 'טוסט גבינה ועגבנייה במחבת', emoji: '🥪', cuisine: 'comfort', time: 7, pans: 1,
    calories: 420, protein: 19, diets: ['vegetarian'], allergens: ['gluten', 'dairy'],
    ingredients: [
      { id: 'bread', qty: '2 פרוסות' }, { id: 'yellow_cheese', qty: '2 פרוסות גבינה' },
      { id: 'tomato', qty: 'פרוסות עגבנייה', optional: true }, { id: 'butter', qty: 'חמאה', optional: true },
      { id: 'olives', qty: 'זיתים', optional: true }, { id: 'pesto', qty: 'פסטו למריחה', optional: true },
    ],
    steps: [
      'מורחים מעט חמאה/שמן על צדי החוץ של הלחם.',
      'ממלאים בגבינה ועגבנייה (ופסטו/זיתים אם יש).',
      'צולים במחבת עם מכסה 3 דקות מכל צד, תוך לחיצה עם מרית.',
    ],
  },
  {
    id: 'quesadilla', title: 'קסדייה מהירה', emoji: '🌮', cuisine: 'mexican', time: 8, pans: 1,
    calories: 470, protein: 22, diets: ['vegetarian'], allergens: ['gluten', 'dairy'],
    ingredients: [
      { id: 'tortilla', qty: '2 טורטיות' }, { id: 'yellow_cheese', qty: 'כוס גבינה מגוררת' },
      { id: 'corn', qty: 'תירס', optional: true }, { id: 'pepper', qty: 'פלפל', optional: true },
      { id: 'avocado', qty: 'אבוקדו להגשה', optional: true }, { id: 'chicken', qty: 'שאריות עוף', optional: true },
    ],
    steps: [
      'מניחים טורטייה במחבת יבשה, מפזרים גבינה ושאר המילויים על חצי.',
      'מקפלים ומחממים 2-3 דקות מכל צד עד שהגבינה נמסה.',
      'חותכים למשולשים, מגישים עם אבוקדו מעוך.',
    ],
  },
  {
    id: 'banana_pancakes', title: 'פנקייק בננה משני רכיבים', emoji: '🥞', cuisine: 'breakfast', time: 10, pans: 1,
    calories: 260, protein: 13, diets: ['vegetarian', 'glutenFree'], allergens: ['egg'],
    ingredients: [
      { id: 'banana', qty: 'בננה בשלה' }, { id: 'eggs', qty: '2 ביצים' },
      { id: 'oats', qty: '2 כפות שיבולת שועל', optional: true }, { id: 'honey', qty: 'דבש להגשה', optional: true },
      { id: 'yogurt', qty: 'יוגורט להגשה', optional: true },
    ],
    steps: [
      'מועכים בננה במזלג ומערבבים עם הביצים (ושיבולת שועל אם יש).',
      'יוצקים עיגולים קטנים למחבת משומנת על אש בינונית.',
      'הופכים אחרי 1-2 דקות. מגישים עם דבש ויוגורט.',
    ],
  },
  {
    id: 'yogurt_bowl', title: 'קערת יוגורט ופירות – בלי בישול', emoji: '🥣', cuisine: 'breakfast', time: 3, pans: 0,
    calories: 300, protein: 14, diets: ['vegetarian', 'glutenFree'], allergens: ['dairy'],
    ingredients: [
      { id: 'yogurt', qty: 'גביע יוגורט' }, { id: 'banana', qty: 'בננה', alt: 'apple' },
      { id: 'oats', qty: 'גרנולה/שיבולת', optional: true }, { id: 'honey', qty: 'דבש', optional: true },
      { id: 'peanut_butter', qty: 'כפית חמאת בוטנים', optional: true },
    ],
    steps: ['יוגורט לקערה, פרי חתוך מעל, גרנולה ודבש. סיימת – ואין כלים לשטוף.'],
  },
  {
    id: 'tuna_wrap', title: 'ראפ טונה ופסטו', emoji: '🌯', cuisine: 'comfort', time: 5, pans: 0,
    calories: 430, protein: 30, diets: ['highProtein'], allergens: ['gluten', 'fish', 'egg'],
    ingredients: [
      { id: 'tuna', qty: 'קופסת טונה' }, { id: 'tortilla', qty: 'טורטייה', alt: 'bread' },
      { id: 'mayo', qty: 'כף מיונז', alt: 'pesto', optional: true }, { id: 'cucumber', qty: 'מלפפון', optional: true },
      { id: 'tomato', qty: 'עגבנייה', optional: true }, { id: 'spinach', qty: 'עלים', optional: true },
    ],
    steps: [
      'מסננים טונה ומערבבים עם מיונז/פסטו, מלח ופלפל.',
      'מורחים על טורטייה, מוסיפים ירקות פרוסים.',
      'מגלגלים חזק וחותכים באלכסון. אפס כלים.',
    ],
  },
  {
    id: 'soy_noodles', title: 'נודלס סויה ושום ב-10 דקות', emoji: '🍜', cuisine: 'asian', time: 10, pans: 2,
    calories: 450, protein: 12, diets: ['vegetarian', 'vegan'], allergens: ['gluten', 'soy'],
    ingredients: [
      { id: 'noodles', qty: 'מנת נודלס', alt: 'pasta' }, { id: 'soy_sauce', qty: '2 כפות סויה' },
      { id: 'garlic', qty: '2 שיני שום', optional: true }, { id: 'honey', qty: 'כפית דבש', optional: true },
      { id: 'green_onion', qty: 'בצל ירוק', optional: true }, { id: 'eggs', qty: 'ביצה מעל', optional: true },
      { id: 'peanut_butter', qty: 'כף חמאת בוטנים', optional: true },
    ],
    steps: [
      'מבשלים נודלס 3-4 דקות ומסננים.',
      'במחבת: שום בשמן 30 שניות, מוסיפים סויה, דבש (וחמאת בוטנים) ומעט מים.',
      'מוסיפים נודלס, מערבבים עד שהרוטב עוטף. מעל – בצל ירוק וביצת עין.',
    ],
  },
  {
    id: 'chicken_stirfry', title: 'מוקפץ עוף וירקות', emoji: '🍗', cuisine: 'asian', time: 15, pans: 1,
    calories: 410, protein: 38, diets: ['highProtein', 'glutenFree', 'keto'], allergens: ['soy'],
    ingredients: [
      { id: 'chicken', qty: '250 גרם חזה עוף' }, { id: 'soy_sauce', qty: '2 כפות סויה' },
      { id: 'pepper', qty: 'פלפל', optional: true }, { id: 'zucchini', qty: 'קישוא', optional: true },
      { id: 'onion', qty: 'בצל', optional: true }, { id: 'garlic', qty: 'שום', optional: true },
      { id: 'honey', qty: 'כפית דבש', optional: true }, { id: 'rice', qty: 'אורז להגשה', optional: true },
    ],
    steps: [
      'חותכים עוף לרצועות דקות. מחממים מחבת חמה מאוד עם שמן.',
      'צורבים את העוף 4 דקות עד הזהבה.',
      'מוסיפים ירקות רצועות ושום ומקפיצים 4 דקות.',
      'סויה ודבש, דקה אחרונה – ומגישים מעל אורז.',
    ],
  },
  {
    id: 'frittata', title: 'פריטטה של "מה שנשאר במקרר"', emoji: '🥧', cuisine: 'italian', time: 15, pans: 1,
    calories: 360, protein: 25, diets: ['vegetarian', 'glutenFree', 'keto', 'highProtein'], allergens: ['egg', 'dairy'],
    ingredients: [
      { id: 'eggs', qty: '4 ביצים' }, { id: 'zucchini', qty: 'קישוא', alt: 'spinach', optional: true },
      { id: 'mushrooms', qty: 'פטריות', optional: true }, { id: 'feta', qty: 'בולגרית', alt: 'yellow_cheese', optional: true },
      { id: 'onion', qty: 'בצל', optional: true }, { id: 'pepper', qty: 'פלפל', optional: true },
    ],
    steps: [
      'מטגנים את כל הירקות שיש (קצוצים) 5 דקות במחבת.',
      'טורפים ביצים עם מלח ופלפל, יוצקים מעל ומפזרים גבינה.',
      'מכסים ומבשלים על אש נמוכה 8 דקות עד שהמרכז יציב.',
    ],
  },
  {
    id: 'hummus_plate', title: 'צלחת חומוס "מסעדה" ביתית', emoji: '🥙', cuisine: 'israeli', time: 5, pans: 0,
    calories: 450, protein: 17, diets: ['vegetarian', 'vegan'], allergens: ['sesame', 'gluten'],
    ingredients: [
      { id: 'hummus', qty: 'כמה כפות חומוס' }, { id: 'bread', qty: 'פיתה' },
      { id: 'eggs', qty: 'ביצה קשה', optional: true }, { id: 'tomato', qty: 'עגבנייה', optional: true },
      { id: 'cucumber', qty: 'מלפפון', optional: true }, { id: 'olives', qty: 'זיתים', optional: true },
      { id: 'chickpeas', qty: 'גרגרי חומוס', optional: true },
    ],
    steps: [
      'מורחים חומוס בתנועה מעגלית בצלחת.',
      'שמן זית, פפריקה, גרגרים ופטרוזיליה במרכז.',
      'לצד: ירקות חתוכים, זיתים וביצה. ממוטטים עם פיתה חמה.',
    ],
  },
  {
    id: 'chickpea_salad', title: 'סלט גרגרי חומוס חלבוני', emoji: '🫘', cuisine: 'israeli', time: 7, pans: 0,
    calories: 380, protein: 16, diets: ['vegetarian', 'vegan', 'glutenFree', 'highProtein'], allergens: [],
    ingredients: [
      { id: 'chickpeas', qty: 'קופסת גרגרים' }, { id: 'tomato', qty: 'עגבנייה', optional: true },
      { id: 'cucumber', qty: 'מלפפון', optional: true }, { id: 'lemon', qty: 'לימון' },
      { id: 'onion', qty: 'בצל סגול', optional: true }, { id: 'herbs', qty: 'פטרוזיליה', optional: true },
      { id: 'feta', qty: 'פטה', optional: true },
    ],
    steps: [
      'מסננים ושוטפים גרגרים.',
      'מוסיפים ירקות קצוצים, לימון, שמן זית, מלח וכמון.',
      'מערבבים ומגישים. מחזיק יום במקרר – אפשר לקחת לעבודה.',
    ],
  },
  {
    id: 'tofu_soy', title: 'טופו פריך בסויה ודבש', emoji: '🧊', cuisine: 'asian', time: 15, pans: 1,
    calories: 340, protein: 24, diets: ['vegetarian', 'vegan', 'highProtein', 'glutenFree'], allergens: ['soy'],
    ingredients: [
      { id: 'tofu', qty: 'קוביית טופו' }, { id: 'soy_sauce', qty: '2 כפות סויה' },
      { id: 'honey', qty: 'כף דבש/סילאן', optional: true }, { id: 'garlic', qty: 'שום', optional: true },
      { id: 'green_onion', qty: 'בצל ירוק', optional: true }, { id: 'rice', qty: 'אורז להגשה', optional: true },
    ],
    steps: [
      'סוחטים טופו במגבת וחותכים לקוביות.',
      'מטגנים בשמן 8 דקות עד שכל הצדדים פריכים.',
      'מוסיפים סויה, דבש ושום ומערבבים עד שמזגג. בצל ירוק מעל.',
    ],
  },
  {
    id: 'tomato_soup', title: 'מרק עגבניות קטיפתי מהיר', emoji: '🥣', cuisine: 'comfort', time: 15, pans: 1,
    calories: 220, protein: 6, diets: ['vegetarian', 'vegan', 'glutenFree'], allergens: [],
    ingredients: [
      { id: 'tomato', qty: '5 עגבניות', alt: 'tomato_sauce' }, { id: 'onion', qty: 'בצל' },
      { id: 'garlic', qty: '2 שיני שום', optional: true }, { id: 'cream', qty: 'שמנת', optional: true },
      { id: 'herbs', qty: 'בזיליקום', optional: true }, { id: 'bread', qty: 'קרוטונים מלחם', optional: true },
    ],
    steps: [
      'מטגנים בצל ושום 4 דקות.',
      'מוסיפים עגבניות קצוצות, כוס מים, מלח וקורט סוכר. מבשלים 8 דקות.',
      'טוחנים בבלנדר מוט, מוסיפים שמנת אם יש. מגישים עם לחם קלוי.',
    ],
  },
  {
    id: 'avocado_toast', title: 'טוסט אבוקדו וביצה', emoji: '🥑', cuisine: 'breakfast', time: 6, pans: 1,
    calories: 390, protein: 16, diets: ['vegetarian'], allergens: ['gluten', 'egg'],
    ingredients: [
      { id: 'bread', qty: '2 פרוסות' }, { id: 'avocado', qty: 'אבוקדו' },
      { id: 'eggs', qty: 'ביצה', optional: true }, { id: 'lemon', qty: 'לימון', optional: true },
      { id: 'tomato', qty: 'עגבנייה', optional: true },
    ],
    steps: [
      'קולים לחם. מועכים אבוקדו עם לימון, מלח ופלפל.',
      'מטגנים ביצת עין.',
      'אבוקדו על הטוסט, ביצה מעל, צ׳ילי ומלח גס.',
    ],
  },
  {
    id: 'potato_eggs', title: 'תפו"א וביצים במחבת (פטטאס)', emoji: '🥔', cuisine: 'comfort', time: 15, pans: 1,
    calories: 430, protein: 16, diets: ['vegetarian', 'glutenFree'], allergens: ['egg'],
    ingredients: [
      { id: 'potato', qty: '2 תפוחי אדמה' }, { id: 'eggs', qty: '2-3 ביצים' },
      { id: 'onion', qty: 'בצל', optional: true }, { id: 'pepper', qty: 'פלפל', optional: true },
    ],
    steps: [
      'חותכים תפו"א לקוביות קטנות, מחממים 4 דקות במיקרו עם מכסה.',
      'מטגנים במחבת עם בצל 6 דקות עד הזהבה.',
      'שוברים ביצים מעל, מכסים 3 דקות. פפריקה ומלח.',
    ],
  },
  {
    id: 'chicken_wrap', title: 'לאפה עוף וטחינה', emoji: '🌯', cuisine: 'israeli', time: 14, pans: 1,
    calories: 560, protein: 40, diets: ['highProtein'], allergens: ['gluten', 'sesame'],
    ingredients: [
      { id: 'chicken', qty: '200 גרם עוף' }, { id: 'tortilla', qty: 'לאפה/טורטייה', alt: 'bread' },
      { id: 'tahini', qty: 'טחינה', alt: 'hummus' }, { id: 'tomato', qty: 'עגבנייה', optional: true },
      { id: 'cucumber', qty: 'מלפפון', optional: true }, { id: 'onion', qty: 'בצל', optional: true },
    ],
    steps: [
      'מתבלים עוף בפפריקה, כמון ומלח וצורבים 8 דקות.',
      'פורסים לרצועות.',
      'מורחים טחינה על הלאפה, עוף וירקות – ומגלגלים.',
    ],
  },
  {
    id: 'oat_porridge', title: 'דייסת שיבולת שועל קרמית', emoji: '🌾', cuisine: 'breakfast', time: 5, pans: 1,
    calories: 320, protein: 12, diets: ['vegetarian'], allergens: ['dairy'],
    ingredients: [
      { id: 'oats', qty: '½ כוס שיבולת' }, { id: 'milk', qty: 'כוס חלב' },
      { id: 'banana', qty: 'בננה', optional: true }, { id: 'honey', qty: 'דבש', optional: true },
      { id: 'peanut_butter', qty: 'חמאת בוטנים', optional: true },
    ],
    steps: [
      'מבשלים שיבולת עם החלב 3-4 דקות תוך ערבוב (או 2 דקות במיקרו).',
      'מוסיפים בננה פרוסה, דבש וחמאת בוטנים.',
    ],
  },
  {
    id: 'mushroom_pasta', title: 'פסטה שמנת ופטריות', emoji: '🍄', cuisine: 'italian', time: 15, pans: 2,
    calories: 640, protein: 18, diets: ['vegetarian'], allergens: ['gluten', 'dairy'],
    ingredients: [
      { id: 'pasta', qty: '200 גרם פסטה' }, { id: 'mushrooms', qty: 'סלסלת פטריות' },
      { id: 'cream', qty: 'מיכל שמנת', alt: 'white_cheese' }, { id: 'garlic', qty: 'שום', optional: true },
      { id: 'parmesan', qty: 'פרמזן', optional: true },
    ],
    steps: [
      'מבשלים פסטה.',
      'מטגנים פטריות ושום בחמאה/שמן 5 דקות.',
      'מוסיפים שמנת (או גבינה לבנה + מעט מי פסטה), מלח ופלפל, מבעבעים 2 דקות.',
      'מערבבים עם הפסטה ופרמזן.',
    ],
  },
];

// תרחיש הדגמה – בדיוק המקרר מהסיפור
export const DEMO_SCAN = [
  { id: 'white_cheese', confidence: 0.97 },
  { id: 'tomato', confidence: 0.93, note: 'נראות קצת עייפות – כדאי להשתמש היום' },
  { id: 'eggs', confidence: 0.98 },
  { id: 'soy_sauce', confidence: 0.91 },
  { id: 'rice', confidence: 0.74, note: 'קופסת אורז מבושל מאתמול' },
  { id: 'green_onion', confidence: 0.68 },
  { id: 'yellow_cheese', confidence: 0.82 },
  { id: 'cucumber', confidence: 0.86 },
  { id: 'lemon', confidence: 0.79 },
];
