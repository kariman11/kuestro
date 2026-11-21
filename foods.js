// Built-in food list for the meal calculator. Values are APPROXIMATE, per 100 g of the food as normally eaten (cooked / ready to eat).
// Line format: name | other names (English + Arabic) | kcal | protein g | carbs g | fat g | unit name | grams in one unit
const FOODS=`
Egg|whole egg,boiled egg,fried egg,eggs,بيض|143|12.6|0.7|9.5|egg|50
Egg white|egg whites,بياض بيض|52|10.9|0.7|0.2|white|33
Chicken breast|chicken,grilled chicken,فراخ,صدور فراخ,بانيه|165|31|0|3.6|breast|150
Chicken thigh|chicken leg,thigh,وراك|209|26|0|10.9|thigh|100
Fried chicken|crispy chicken,broasted,فراخ مقلية,بروستد|270|19|10|16|piece|120
Beef (cooked)|meat,steak,beef,لحمة,لحم,ستيك|250|26|0|15
Minced beef|ground beef,kofta,كفتة,لحمة مفرومة,مفروم|254|26|0|17
Lamb (cooked)|lamb,mutton,ضاني,كباب|294|25|0|21
Turkey breast|turkey,رومي|135|30|0|1
Tuna (canned)|tuna,تونة|116|26|0|1|can|120
Salmon (cooked)|salmon,سلمون|206|22|0|12
White fish (cooked)|fish,tilapia,cod,سمك,بلطي,قاروص|105|23|0|1
Shrimp (cooked)|shrimp,prawns,جمبري|99|24|0.2|0.3
Liver (cooked)|beef liver,liver,كبدة|175|27|4|5
Whey protein|protein powder,whey,بروتين|400|80|8|6|scoop|30
Milk (whole)|milk,لبن,حليب|61|3.2|4.8|3.3|cup|244
Milk (skim)|skim milk,low fat milk,لبن خالي الدسم|34|3.4|5|0.1|cup|245
Yogurt (plain)|yogurt,yoghurt,زبادي|61|3.5|4.7|3.3|cup|245
Greek yogurt|greek,يوناني|97|9|3.9|5|cup|170
Labneh|لبنة|160|6|4|13|tbsp|20
White cheese (feta)|cheese,feta,white cheese,جبنة بيضاء,جبنة,دومتي|264|14|4|21|slice|30
Cheddar cheese|cheddar,yellow cheese,جبنة رومي,جبنة صفراء|403|25|1.3|33|slice|28
Mozzarella|موزاريلا|280|28|3.1|17|slice|28
Cottage cheese|cottage,جبنة قريش,قريش|98|11|3.4|4.3
Cream cheese|جبنة كريمي,كريمي|342|6|4|34|tbsp|15
Butter|زبدة|717|0.9|0.1|81|tbsp|14
White rice (cooked)|rice,رز,أرز|130|2.7|28|0.3|cup|158
Brown rice (cooked)|brown rice,رز بني|123|2.7|26|1|cup|195
Pasta (cooked)|pasta,macaroni,spaghetti,مكرونة|158|5.8|31|0.9|cup|140
White bread|bread,toast,توست|265|9|49|3.2|slice|30
Baladi bread|baladi,aish baladi,pita,عيش بلدي,عيش|275|9|55|1.5|loaf|100
Whole wheat bread|brown bread,whole wheat,عيش أسمر,توست أسمر|247|13|41|3.4|slice|32
Oats (dry)|oats,oatmeal,شوفان|389|16.9|66|6.9|cup|80
Cornflakes|cereal,corn flakes,كورن فليكس|357|7.5|84|0.4|cup|28
Potato (boiled)|potato,potatoes,boiled potato,بطاطس مسلوقة,بطاطس|87|1.9|20|0.1|potato|170
French fries|fries,chips,بطاطس مقلية|312|3.4|41|15|portion|117
Sweet potato (baked)|sweet potato,بطاطا|90|2|21|0.2|potato|130
Bulgur (cooked)|bulgur,burghul,برغل|83|3.1|18.6|0.2|cup|182
Koshari|kushari,koshary,كشري|165|5|30|3|plate|350
Ful medames|ful,foul,fava beans,فول,فول مدمس|120|7|17|2.5|plate|250
Ta'ameya (falafel)|falafel,taameya,tamiya,طعمية,فلافل|333|13|32|18|piece|17
Hummus|houmous,حمص بالطحينة,حمص الشام|166|8|14|10|tbsp|15
Chickpeas (cooked)|chickpeas,garbanzo,حمص|164|8.9|27|2.6|cup|164
Lentils (cooked)|lentils,عدس|116|9|20|0.4|cup|198
Beans (cooked)|beans,kidney beans,black beans,فاصوليا,لوبيا|132|8.9|24|0.5|cup|180
Molokhia (cooked)|molokhia,mulukhiyah,ملوخية|60|4|6|2|plate|250
Mahshi (stuffed vegetables)|mahshi,mahshy,محشي|140|3|22|4|piece|60
Banana|موز|89|1.1|23|0.3|banana|118
Apple|تفاح|52|0.3|14|0.2|apple|182
Orange|برتقال|47|0.9|12|0.1|orange|130
Mandarin|tangerine,يوسفي|53|0.8|13|0.3|mandarin|90
Dates|date,تمر,بلح|282|2.5|75|0.4|date|10
Grapes|عنب|69|0.7|18|0.2|cup|150
Strawberries|strawberry,فراولة|32|0.7|7.7|0.3|cup|150
Watermelon|بطيخ|30|0.6|7.6|0.2|slice|280
Mango|mangoes,مانجو|60|0.8|15|0.4|mango|200
Guava|جوافة|68|2.6|14|1|guava|90
Pear|كمثرى|57|0.4|15|0.1|pear|178
Peach|خوخ|39|0.9|10|0.3|peach|150
Figs|fig,تين|74|0.8|19|0.3|fig|50
Pomegranate|رمان|83|1.7|19|1.2|cup|174
Avocado|أفوكادو|160|2|9|15|avocado|150
Tomato|tomatoes,طماطم,بندورة|18|0.9|3.9|0.2|tomato|123
Cucumber|خيار|15|0.7|3.6|0.1|cucumber|150
Lettuce|خس|15|1.4|2.9|0.2|cup|36
Carrot|جزر|41|0.9|10|0.2|carrot|60
Broccoli (cooked)|broccoli,بروكلي|35|2.4|7|0.4|cup|156
Spinach (cooked)|spinach,سبانخ|23|3|3.8|0.3|cup|180
Onion|بصل|40|1.1|9.3|0.1|onion|110
Eggplant (cooked)|aubergine,باذنجان|35|0.8|8.7|0.2
Zucchini|courgette,كوسة|17|1.2|3.1|0.3|zucchini|200
Okra (cooked)|bamia,بامية|33|1.9|7|0.2|cup|160
Peas (cooked)|peas,بسلة|84|5.4|15|0.2|cup|160
Green salad|salad,سلطة|20|1.2|3.5|0.2|bowl|150
Olive oil|زيت زيتون|884|0|0|100|tbsp|13.5
Vegetable oil|oil,sunflower oil,corn oil,زيت|884|0|0|100|tbsp|14
Ghee|samna,سمن|876|0|0|99|tbsp|13
Almonds|لوز|579|21|22|50|handful|28
Walnuts|عين جمل|654|15|14|65|handful|28
Peanuts|فول سوداني|567|26|16|49|handful|28
Cashews|كاجو|553|18|30|44|handful|28
Mixed nuts|nuts,مكسرات|607|20|21|54|handful|28
Peanut butter|زبدة فول سوداني|588|25|20|50|tbsp|16
Tahini|طحينة|595|17|21|54|tbsp|15
Chia seeds|chia|486|17|42|31|tbsp|12
Honey|عسل|304|0.3|82|0|tbsp|21
Sugar|سكر|387|0|100|0|tsp|4
Jam|مربى|250|0.4|65|0.1|tbsp|20
Chocolate spread|nutella|539|6|58|31|tbsp|19
Mayonnaise|مايونيز|680|1|0.6|75|tbsp|14
Ketchup|كاتشب|101|1|27|0.1|tbsp|17
Milk chocolate|chocolate,شوكولاتة|535|7.6|59|30|bar|45
Dark chocolate|dark chocolate|546|5|61|31|square|10
Biscuit|cookie,cookies,بسكويت|480|6|66|21|biscuit|12
Potato chips|crisps,chips bag,شيبسي|536|7|53|35|bag|28
Ice cream|ايس كريم,آيس كريم|207|3.5|24|11|scoop|66
Cake|كيك|350|5|55|12|slice|80
Basbousa|بسبوسة|380|4|56|15|piece|80
Kunafa|konafa,كنافة|400|7|45|22|piece|100
Rice pudding|roz bel laban,رز بلبن|120|3|20|3|bowl|200
Om Ali|um ali,ام علي|250|6|28|13|bowl|200
Cola|soda,pepsi,coke,كولا,بيبسي|42|0|10.6|0|can|330
Orange juice|juice,عصير|45|0.7|10.4|0.2|cup|248
Coffee (black)|coffee,قهوة|1|0.1|0|0|cup|240
Tea (no sugar)|tea,شاي|1|0|0.2|0|cup|240
Latte|cappuccino,لاتيه|56|3|5|2.5|cup|360
Pizza|بيتزا|266|11|33|10|slice|107
Burger (with bun)|burger,hamburger,برجر|255|13|24|12|burger|200
Chicken shawarma sandwich|shawarma,شاورما|215|14|20|9|sandwich|250
Hawawshi|حواوشي|290|13|22|17|piece|200
Lentil soup|shorba,soup,شوربة عدس|55|3.5|9|0.7|bowl|250
`.trim().split('\n').map(l=>{const [n,a,k,p,c,f,u,ug]=l.split('|');return {n,a:a||'',k:+k,p:+p,c:+c,f:+f,u:u||'',ug:+ug||0}});
