import { Injectable, effect, signal } from '@angular/core';
import { FAT_LABELS, Lang, Product, availableOrigins, countryFlag, countryName, formatNumber, formatWeight, hasPriceRange, lowestPrice, originsOf } from './data';
import { DaySchedule, OrderingState, algeriaClock, scheduleLines } from './ordering';

const FR = {
  brandSub: 'VIANDE HALAL', halal: 'Viande halal', langBtn: 'العربية',
  topOpen: 'Ouvert du samedi au jeudi',
  navHome: 'Accueil', navMeat: 'Nos viandes', navAbout: 'Notre engagement', navOffers: 'Formules', navContact: 'Contact', order: 'Commander',
  heroEyebrow: 'Boucherie halal · Aïn El Berd',
  origin: 'Origine', chooseOrigin: 'Choisissez le pays d\'origine', unavailable: 'Indisponible', weightShort: 'Poids', resTitle: 'Réservations', resNone: 'Aucune réservation ouverte pour le moment.', resQty: 'Quantité', resSend: 'Réserver', resDeposit: 'Acompte à régler à la boutique : {x}.', resUntil: 'Réservation possible jusqu\'au {d}.', resBadTel: 'Vérifiez votre numéro de téléphone.', resBadDate: 'Choisissez une date de retrait proposée.', resDone: 'Réservation reçue', resDoneText: 'La boucherie vous contactera pour la confirmer.', resBannerBtn: 'Réserver maintenant', favNav: 'Mes favoris', favTitle: 'Mes favoris', favLead: 'Retrouvez vos produits préférés en un clic.', favEmpty: 'Touchez le cœur sur un produit pour le garder ici.', favAdd: 'Ajouter aux favoris', favRemove: 'Retirer des favoris', suggestTitle: 'Complétez votre panier', reorder: 'Recommander', reorderTitle: 'Votre commande habituelle ?', reorderText: 'Refaites votre dernière commande en un clic, aux prix du jour.', reorderMissing: '{n} article(s) ne sont plus disponibles.', reorderNone: 'Ces articles ne sont plus disponibles.', loyaltyNav: 'Ma fidélité', loyaltyTitle: 'Ma carte de fidélité', loyaltyRule: 'Gagnez 1 point par tranche de {x} achetée.', loyaltySoon: 'La carte de fidélité arrive bientôt.', loyaltyCheck: 'Voir mes points', loyaltyYours: 'Vos points', loyaltyBadTel: 'Vérifiez votre numéro de téléphone.', loyaltyGift: 'votre cadeau', loyaltyLeft: 'Encore {n} points pour obtenir : {r}.', loyaltyReady: 'Bravo ! Vous avez gagné : {r}. Demandez-le à la boucherie.', loyaltyEarn: 'Cette commande vous rapportera {n} points de fidélité.', menuNav: 'Mon menu', menuTitle: 'Composez votre menu', menuLead: 'Dites-nous combien vous êtes : nous vous proposons un menu selon votre budget et nos produits disponibles.', menuGuests: 'Nombre de personnes', menuBudget: 'Budget', menuStyle: 'Style de repas', menuAll: 'Tout voir', menuFeast: 'Repas de fête', menuSimple: 'Menu simple', menuGrill: 'Grillades', menuFish: 'Poisson', menuMore: 'Voir plus de menus', menuNoLimit: 'Sans limite', menuEach: 'par personne', menuAdd: 'Ajouter tout au panier', menuAdded: 'Ajouté au panier ✓', menuOver: 'Un peu au-dessus de votre budget : c\'est notre menu le moins cher.', menuNone: 'Aucun menu disponible pour le moment.', menuNote: 'Quantités indicatives. Les plats farcis se réservent au moins 6 h à l\'avance.', menuBannerTitle: 'Des invités à la maison ?', menuBannerText: 'Dites-nous combien vous êtes et votre budget : nous composons le menu pour vous.', menuBannerBtn: 'Proposez-moi un menu', finalPrice: 'Prix final : ingrédients et préparation inclus.', pendingPrice: 'La boucherie vous confirmera le prix final.', addShort: 'Ajouter', meatKind: 'Viande hachée', meatWeight: 'Poids de viande', extras: 'Ingrédients supplémentaires', customPrice: 'Prix selon vos choix', cutShort: 'Découpe', otherWeight: 'Autre', specialTag: 'Sur réservation', specialNote: 'À réserver au moins 6 h à l\'avance.', specialCheckout: 'Commande spéciale : préparée pour vous. Choisissez le jour et l\'heure.', specialNight: 'Boutique fermée : votre réservation sera confirmée à l\'ouverture.', chooseSlot: 'Heure de retrait', noSlot: 'Aucun créneau ce jour-là : choisissez une autre date.', slotRequired: 'Choisissez un créneau de retrait.', specialOrder: 'Commande spéciale', slotLabel: 'Créneau', priceFrom: 'Dès', allCountries: 'Tous les pays', aboutNav: 'Notre boucherie', aboutShop: 'Notre magasin', aboutCommit: 'Nos engagements', aboutCertificates: 'Nos certificats', aboutEmpty: 'Cette page arrive bientôt.', rights: 'Tous droits réservés', madeBy: 'Développé par', installApp: 'Application Boucherie Hallem', installText: 'Commandez directement depuis votre téléphone.', installBtn: 'Installer', installLater: 'Plus tard',
  heroOpen: 'Commandes ouvertes', heroLine1: 'La viande fraîche,', heroLine2: 'coupée pour vous.', pointHalal: '100 % halal', pointCut: 'Découpe à la demande', pointDelivery: 'Retrait ou livraison',
  heroTitleA: 'Viande fraîche', heroTitleB: '& 100% halal',
  heroText: 'Agneau, bœuf et poulet frais chaque jour, abattus selon le rite musulman. Découpe sur mesure et préparations maison.',
  heroCta1: 'Commander sur WhatsApp', heroCta2: 'Découvrir nos viandes',
  catEyebrow: 'Nos rayons',
  meatEyebrow: 'Nos viandes', meatTitle: "Le meilleur de l'étal",
  meatText: 'Chaque morceau est choisi et préparé par nos bouchers. Découpe et hachage à la demande.',
  orderThis: 'Commander', orderFor: 'Je souhaite :',
  aboutEyebrow: 'Notre engagement', aboutTitle: 'Le savoir-faire du boucher de quartier',
  aboutP1: "Nos bêtes sont sélectionnées auprès d'éleveurs de la région et abattues selon le rite musulman. Nous découpons sur place pour garantir fraîcheur et qualité.",
  w1t: 'Abattage halal', w1: 'Bêtes abattues selon le rite musulman, en toute transparence.',
  w2t: 'Fraîcheur du jour', w2: 'Arrivages quotidiens, découpe sur place devant vous.',
  w3t: 'Éleveurs de la région', w3: 'Agneau et bœuf sélectionnés autour de Sidi Bel Abbès.',
  w4t: 'Commande facile', w4: 'Commandez en ligne, nous confirmons sur WhatsApp.',
  s1: 'Halal', s2: 'Viande fraîche du jour', s3: 'Découpe à la demande',
  offEyebrow: 'Colis & plateaux', offTitle: 'Nos formules',
  offText: "Des assortiments pour la famille, la chouwa ou les grandes occasions. À commander 24 h à l'avance.",
  aidTitle: 'Spécial Aïd el-Adha',
  aidText: "Réservez votre mouton, nous nous occupons de l'abattage et de la découpe selon vos souhaits.",
  aidCta: 'Réserver mon mouton',
  cEyebrow: 'Contact & commande', cTitle: 'Passez nous voir ou commandez',
  cText: 'Envoyez votre commande sur WhatsApp, elle sera prête à votre arrivée.',
  addrT: 'Adresse', mapLink: 'Voir sur Google Maps', telT: 'Téléphone', hoursT: 'Horaires',
  fTitle: 'Précommande', fName: 'Nom complet', fTel: 'Téléphone', fType: 'Type de commande',
  fAid: "Mouton de l'Aïd", fCustom: 'Commande sur mesure',
  fDetails: 'Détails : morceaux, quantités, découpe souhaitée…', fSend: 'Envoyer sur WhatsApp',
  fOk: 'Merci ! Votre commande a bien été enregistrée.', fNote: 'Paiement en boutique au retrait de votre commande.',
  footerText: 'Votre boucherie halal de confiance à Aïn El Berd : viande fraîche, découpe à la demande et commande en ligne.',
  footerLinks: 'Liens rapides', footer: 'Viande 100% halal · Aïn El Berd', waFloat: 'Nous écrire sur WhatsApp',
  from: 'dès', perKg: 'DA/kg', perPiece: 'DA/pièce', onOrder: 'sur commande', currency: 'DA',
  reserve: 'Réserver', popular: 'Le plus demandé',
  msgHello: 'Bonjour, je souhaite passer une commande :', msgName: 'Nom', msgTel: 'Tél', msgType: 'Commande', msgDate: 'Date', msgDetails: 'Détails',
  navShop: 'Boutique', cart: 'Panier', all: 'Tout',
  search: 'Rechercher une viande, une coupe…', sortDefault: 'Tri : recommandé', sortAsc: 'Prix croissant', sortDesc: 'Prix décroissant',
  noResult: 'Aucun produit trouvé.', shopTitle: 'Notre boutique',
  shopText: 'Choisissez votre coupe, votre poids et votre découpe : nous préparons tout à la commande.',
  catTitle: 'Choisissez votre viande', popularEyebrow: 'Les plus demandés', popularTitle: 'Les coupes préférées',
  seeAll: 'Voir toute la boutique', choose: 'Choisir', perKgFrom: 'le kg', perPieceLabel: 'la pièce',
  chooseWeight: 'Choisissez le poids', customWeight: 'Autre poids (g)', chooseCut: 'Choisissez la découpe',
  quantity: 'Quantité', total: 'Total', addCart: 'Ajouter au panier', added: 'Ajouté au panier',
  sameCat: 'Dans le même rayon', back: 'Retour à la boutique',
  cartEmpty: 'Votre panier est vide.', checkout: 'Passer la commande', keepShopping: 'Continuer mes achats',
  estimate: 'Prix estimé : le poids exact est ajusté à la découpe.', toConfirm: 'à confirmer', remove: 'Retirer',
  pickupDate: 'Date de retrait', checkoutTitle: 'Finaliser ma commande', summary: 'Récapitulatif', notes: 'Remarques (facultatif)',
  confirmWa: 'Confirmer sur WhatsApp', doneTitle: 'Commande envoyée !', doneText: 'Votre boucher a bien reçu votre commande. Vous recevrez la confirmation sur WhatsApp.',
  backHome: "Retour à l'accueil", gr: 'g', kg: 'kg', articles: 'articles', basket: 'Panier', customOrder: 'Une demande particulière ?',
  stickyCart: 'Voir le panier',
  byWeight: 'Par poids', byAmount: 'Par montant', amountLabel: 'Votre montant (DA)', amountGives: 'Soit environ', amountHint: 'Exemple : 500 DA de kefta',
  backOn: 'De retour {d}', backSoon: 'Bientôt de retour', notifyMe: 'Me prévenir sur WhatsApp',
  notifyMsg: 'Bonjour, prévenez-moi quand ce produit sera de retour : {p}',
  soldOut: 'Épuisé', stockLeft: 'Plus que {x} en stock', tooMuch: 'Quantité disponible : {x}',
  newsTitle: 'Offres et arrivages', newsEmpty: "Pas d'annonce aujourd'hui.", newsToday: "Aujourd'hui chez nous", marketing: 'Je veux recevoir les offres et les arrivages sur WhatsApp',
  zone: 'Commune ou quartier', zoneChoose: 'Choisissez…', trackLink: 'Suivre ma commande', trackTitle: 'Suivi de commande',
  trackNew: 'Commande reçue', trackConfirmed: 'Commande confirmée', trackReady: 'Commande prête', trackOnWay: 'En cours de livraison',
  trackDelivered: 'Commande livrée', trackPicked: 'Commande récupérée', trackCancelled: 'Cette commande a été annulée.',
  trackMissing: 'Commande introuvable.',
  pickupBoth: 'Commandez en ligne : retrait à la boucherie ou livraison', stepBoth: 'À la boucherie ou livrée chez vous.',
  modeTitle: 'Comment recevoir votre commande ?', modePickup: 'Retrait à la boucherie', modePickupHint: 'Gratuit',
  modeDelivery: 'Livraison', address: 'Adresse de livraison', deliveryDate: 'Date de livraison', subtotal: 'Sous-total',
  delivery: 'Livraison', free: 'Gratuite', freeLeft: 'Plus que {x} pour la livraison gratuite', payDelivery: 'Paiement à la livraison.',
  pickup: 'Commandez en ligne, récupérez à la boucherie', sendOrder: 'Envoyer ma commande', closedTitle: 'Commandes fermées pour le moment', closedPaused: 'Votre panier est gardé : revenez un peu plus tard.', closedBack: 'Reprise {d} à {t}.', closedToday: "aujourd'hui", closedTomorrow: 'demain', closedBtn: 'Commandes fermées', dayClosed: 'La boucherie est fermée ce jour-là : choisissez une autre date.', closedDay: 'Fermé', sending: 'Envoi en cours…', orderRef: 'Numéro de commande', quickAdd: 'Ajouter',
  telInvalid: 'Entrez un numéro valide : 05, 06 ou 07 suivi de 8 chiffres.',
  orderFail: "La commande n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.",
  statCuts: 'coupes au choix', statCats: 'rayons', statMin: 'grammes minimum', stepsTitle: 'Commander, c’est simple',
  step1t: 'Choisissez', step1: 'Votre coupe, votre poids et votre découpe.',
  step2t: 'Envoyez', step2: 'Votre commande arrive directement chez votre boucher.',
  step3t: 'Confirmation', step3: 'Nous vous confirmons la commande sur WhatsApp.',
  step4t: 'Récupérez', step4: 'Passez prendre votre commande à la boucherie.',
};

export type TKey = keyof typeof FR;

const AR: Record<TKey, string> = {
  brandSub: 'لحم حلال', halal: 'لحم حلال', langBtn: 'Français',
  topOpen: 'مفتوح من السبت إلى الخميس',
  navHome: 'الرئيسية', navMeat: 'لحومنا', navAbout: 'التزامنا', navOffers: 'العروض', navContact: 'اتصل بنا', order: 'اطلب الآن',
  heroEyebrow: 'جزارة حلال · عين البرد',
  origin: 'المنشأ', chooseOrigin: 'اختر بلد المنشأ', unavailable: 'غير متوفر', weightShort: 'الوزن', resTitle: 'الحجوزات', resNone: 'لا يوجد حجز مفتوح حالياً.', resQty: 'الكمية', resSend: 'احجز', resDeposit: 'العربون يدفع في المحل: {x}.', resUntil: 'الحجز ممكن إلى غاية {d}.', resBadTel: 'تحقق من رقم هاتفك.', resBadDate: 'اختر تاريخ استلام مقترح.', resDone: 'تم استلام الحجز', resDoneText: 'ستتصل بك الجزارة لتأكيده.', resBannerBtn: 'احجز الآن', favNav: 'مفضلاتي', favTitle: 'مفضلاتي', favLead: 'اعثر على منتجاتك المفضلة بنقرة واحدة.', favEmpty: 'اضغط على القلب في أي منتج لحفظه هنا.', favAdd: 'أضف إلى المفضلة', favRemove: 'احذف من المفضلة', suggestTitle: 'أكمل سلتك', reorder: 'أعد الطلب', reorderTitle: 'طلبك المعتاد؟', reorderText: 'أعد طلبك الأخير بنقرة واحدة، بأسعار اليوم.', reorderMissing: '{n} من المنتجات لم تعد متوفرة.', reorderNone: 'هذه المنتجات لم تعد متوفرة.', loyaltyNav: 'نقاط الوفاء', loyaltyTitle: 'بطاقة الوفاء', loyaltyRule: 'اربح نقطة عن كل {x} من مشترياتك.', loyaltySoon: 'بطاقة الوفاء قريباً.', loyaltyCheck: 'عرض نقاطي', loyaltyYours: 'نقاطك', loyaltyBadTel: 'تحقق من رقم هاتفك.', loyaltyGift: 'هديتك', loyaltyLeft: 'بقي {n} نقطة للحصول على: {r}.', loyaltyReady: 'مبروك! ربحت: {r}. اطلبها من الجزارة.', loyaltyEarn: 'سيمنحك هذا الطلب {n} نقطة وفاء.', menuNav: 'قائمتي', menuTitle: 'كوّن قائمتك', menuLead: 'أخبرنا بعددكم: نقترح عليك قائمة حسب ميزانيتك والمنتجات المتوفرة.', menuGuests: 'عدد الأشخاص', menuBudget: 'الميزانية', menuStyle: 'نوع الوجبة', menuAll: 'عرض الكل', menuFeast: 'وجبة عزومة', menuSimple: 'قائمة بسيطة', menuGrill: 'مشويات', menuFish: 'سمك', menuMore: 'عرض قوائم أخرى', menuNoLimit: 'بدون حد', menuEach: 'للشخص', menuAdd: 'أضف الكل إلى السلة', menuAdded: 'أضيف إلى السلة ✓', menuOver: 'أعلى قليلاً من ميزانيتك: هذه أرخص قائمة لدينا.', menuNone: 'لا توجد قائمة متاحة حالياً.', menuNote: 'الكميات تقريبية. تحجز الأطباق المحشية قبل 6 ساعات على الأقل.', menuBannerTitle: 'عندك ضيوف في الدار؟', menuBannerText: 'أخبرنا بعددكم وميزانيتك: نحضّر لك القائمة.', menuBannerBtn: 'اقترح لي قائمة', finalPrice: 'السعر النهائي: يشمل المكونات والتحضير.', pendingPrice: 'ستؤكد لك الجزارة السعر النهائي.', addShort: 'أضف', meatKind: 'اللحم المفروم', meatWeight: 'وزن اللحم', extras: 'مكونات إضافية', customPrice: 'السعر حسب اختياراتك', cutShort: 'التقطيع', otherWeight: 'آخر', specialTag: 'بالحجز', specialNote: 'يحجز قبل 6 ساعات على الأقل.', specialCheckout: 'طلب خاص يحضر لك: اختر اليوم والساعة.', specialNight: 'الجزارة مغلقة: سيتم تأكيد حجزك عند الفتح.', chooseSlot: 'ساعة الاستلام', noSlot: 'لا يوجد وقت متاح في هذا اليوم: اختر تاريخا آخر.', slotRequired: 'اختر وقت الاستلام.', specialOrder: 'طلب خاص', slotLabel: 'الوقت', priceFrom: 'ابتداءً من', allCountries: 'كل البلدان', aboutNav: 'جزارتنا', aboutShop: 'محلنا', aboutCommit: 'التزاماتنا', aboutCertificates: 'شهاداتنا', aboutEmpty: 'هذه الصفحة قادمة قريبا.', rights: 'جميع الحقوق محفوظة', madeBy: 'من تطوير', installApp: 'تطبيق جزارة حلّام', installText: 'اطلب مباشرة من هاتفك.', installBtn: 'تثبيت', installLater: 'لاحقا',
  heroOpen: 'الطلبات مفتوحة', heroLine1: 'لحم طازج،', heroLine2: 'مقطّع حسب طلبك.', pointHalal: 'حلال 100%', pointCut: 'تقطيع حسب الطلب', pointDelivery: 'استلام أو توصيل',
  heroTitleA: 'لحم طازج', heroTitleB: 'وحلال 100%',
  heroText: 'لحم الغنم والبقر والدجاج طازج كل يوم، مذبوح على الطريقة الإسلامية. تقطيع حسب الطلب ومستحضرات منزلية.',
  heroCta1: 'اطلب عبر واتساب', heroCta2: 'اكتشف لحومنا',
  catEyebrow: 'أقسامنا',
  meatEyebrow: 'لحومنا', meatTitle: 'أجود ما في المحل',
  meatText: 'كل قطعة يختارها ويحضّرها جزارونا. تقطيع وفرم حسب الطلب.',
  orderThis: 'اطلب', orderFor: 'أريد:',
  aboutEyebrow: 'التزامنا', aboutTitle: 'خبرة جزار الحي',
  aboutP1: 'نختار مواشينا من مربّين في المنطقة وتُذبح على الطريقة الإسلامية. نقوم بالتقطيع في المحل لضمان الطراوة والجودة.',
  w1t: 'ذبح حلال', w1: 'مواشٍ مذبوحة على الطريقة الإسلامية بكل شفافية.',
  w2t: 'طازج كل يوم', w2: 'توريد يومي وتقطيع أمامك في المحل.',
  w3t: 'مربّون من المنطقة', w3: 'خرفان وأبقار مختارة من نواحي سيدي بلعباس.',
  w4t: 'طلب سهل', w4: 'اطلب عبر الموقع ونؤكد لك عبر واتساب.',
  s1: 'حلال', s2: 'لحم طازج يومياً', s3: 'تقطيع حسب الطلب',
  offEyebrow: 'الطرود والصواني', offTitle: 'عروضنا',
  offText: 'تشكيلات للعائلة، للشواء أو للمناسبات الكبرى. يُطلب قبل 24 ساعة.',
  aidTitle: 'عرض عيد الأضحى',
  aidText: 'احجز أضحيتك، ونتكفل بالذبح والتقطيع حسب رغبتك.',
  aidCta: 'احجز أضحيتي',
  cEyebrow: 'اتصال وطلب', cTitle: 'زورونا أو اطلبوا الآن',
  cText: 'أرسل طلبك عبر واتساب وسيكون جاهزاً عند وصولك.',
  addrT: 'العنوان', mapLink: 'عرض على خرائط Google', telT: 'الهاتف', hoursT: 'أوقات العمل',
  fTitle: 'طلب مسبق', fName: 'الاسم الكامل', fTel: 'رقم الهاتف', fType: 'نوع الطلب',
  fAid: 'أضحية العيد', fCustom: 'طلب خاص',
  fDetails: 'التفاصيل: القطع، الكميات، طريقة التقطيع…', fSend: 'أرسل عبر واتساب',
  fOk: 'شكراً! تم تسجيل طلبك.', fNote: 'الدفع في المحل عند الاستلام.',
  footerText: 'جزارتكم الحلال الموثوقة في عين البرد: لحم طازج، تقطيع حسب الطلب وطلب عبر الموقع.',
  footerLinks: 'روابط سريعة', footer: 'لحم حلال 100% · عين البرد', waFloat: 'راسلنا عبر واتساب',
  from: 'ابتداءً من', perKg: 'دج/كغ', perPiece: 'دج/للقطعة', onOrder: 'حسب الطلب', currency: 'دج',
  reserve: 'احجز', popular: 'الأكثر طلباً',
  msgHello: 'السلام عليكم، أريد تقديم طلب:', msgName: 'الاسم', msgTel: 'الهاتف', msgType: 'الطلب', msgDate: 'التاريخ', msgDetails: 'التفاصيل',
  navShop: 'المتجر', cart: 'السلة', all: 'الكل',
  search: 'ابحث عن لحم أو قطعة…', sortDefault: 'الترتيب: الموصى به', sortAsc: 'السعر تصاعدياً', sortDesc: 'السعر تنازلياً',
  noResult: 'لا توجد منتجات.', shopTitle: 'متجرنا',
  shopText: 'اختر القطعة والوزن وطريقة التقطيع: نحضّر كل شيء عند الطلب.',
  catTitle: 'اختر لحمك', popularEyebrow: 'الأكثر طلباً', popularTitle: 'القطع المفضلة',
  seeAll: 'عرض كل المتجر', choose: 'اختر', perKgFrom: 'للكيلو', perPieceLabel: 'للقطعة',
  chooseWeight: 'اختر الوزن', customWeight: 'وزن آخر (غ)', chooseCut: 'اختر طريقة التقطيع',
  quantity: 'الكمية', total: 'المجموع', addCart: 'أضف إلى السلة', added: 'أضيف إلى السلة',
  sameCat: 'من نفس القسم', back: 'العودة إلى المتجر',
  cartEmpty: 'سلتك فارغة.', checkout: 'إتمام الطلب', keepShopping: 'مواصلة التسوق',
  estimate: 'السعر تقديري: يُضبط الوزن الدقيق عند التقطيع.', toConfirm: 'يُؤكَّد لاحقاً', remove: 'حذف',
  pickupDate: 'تاريخ الاستلام', checkoutTitle: 'إتمام طلبي', summary: 'ملخص الطلب', notes: 'ملاحظات (اختياري)',
  confirmWa: 'تأكيد عبر واتساب', doneTitle: 'تم إرسال الطلب!', doneText: 'وصل طلبك إلى جزارك. ستصلك رسالة التأكيد عبر واتساب.',
  backHome: 'العودة إلى الرئيسية', gr: 'غ', kg: 'كغ', articles: 'منتجات', basket: 'السلة', customOrder: 'طلب خاص؟',
  stickyCart: 'عرض السلة',
  byWeight: 'حسب الوزن', byAmount: 'حسب المبلغ', amountLabel: 'المبلغ (دج)', amountGives: 'أي حوالي', amountHint: 'مثال: كفتة بـ 500 دج',
  backOn: 'يعود {d}', backSoon: 'يعود قريباً', notifyMe: 'أعلمني عبر واتساب',
  notifyMsg: 'السلام عليكم، أعلموني عند توفر هذا المنتج: {p}',
  soldOut: 'نفد', stockLeft: 'بقي {x} فقط', tooMuch: 'الكمية المتوفرة: {x}',
  newsTitle: 'العروض والوصولات', newsEmpty: 'لا توجد إعلانات اليوم.', newsToday: 'اليوم عندنا', marketing: 'أريد استلام العروض والوصولات الجديدة عبر واتساب',
  zone: 'البلدية أو الحي', zoneChoose: 'اختر…', trackLink: 'تتبع طلبي', trackTitle: 'تتبع الطلب',
  trackNew: 'تم استلام الطلب', trackConfirmed: 'تم تأكيد الطلب', trackReady: 'الطلب جاهز', trackOnWay: 'في الطريق إليك',
  trackDelivered: 'تم توصيل الطلب', trackPicked: 'تم استلام الطلب من الجزارة', trackCancelled: 'تم إلغاء هذا الطلب.',
  trackMissing: 'الطلب غير موجود.',
  pickupBoth: 'اطلب عبر الموقع: استلام من الجزارة أو توصيل', stepBoth: 'من الجزارة أو يصلك إلى البيت.',
  modeTitle: 'كيف تريد استلام طلبك؟', modePickup: 'الاستلام من الجزارة', modePickupHint: 'مجاني',
  modeDelivery: 'التوصيل', address: 'عنوان التوصيل', deliveryDate: 'تاريخ التوصيل', subtotal: 'المجموع الفرعي',
  delivery: 'التوصيل', free: 'مجاني', freeLeft: 'بقي {x} للتوصيل المجاني', payDelivery: 'الدفع عند التوصيل.',
  pickup: 'اطلب عبر الموقع واستلم من الجزارة', sendOrder: 'أرسل طلبي', closedTitle: 'الطلبات مغلقة حاليا', closedPaused: 'سلتك محفوظة: عد بعد قليل.', closedBack: 'تستأنف الطلبات {d} على الساعة {t}.', closedToday: 'اليوم', closedTomorrow: 'غدا', closedBtn: 'الطلبات مغلقة', dayClosed: 'الجزارة مغلقة في هذا اليوم: اختر تاريخا آخر.', closedDay: 'مغلق', sending: 'جارٍ الإرسال…', orderRef: 'رقم الطلب', quickAdd: 'أضف',
  telInvalid: 'أدخل رقماً صحيحاً: 05 أو 06 أو 07 متبوعاً بـ 8 أرقام.',
  orderFail: 'تعذر إرسال الطلب. تحقق من اتصالك وحاول مرة أخرى.',
  statCuts: 'قطعة للاختيار', statCats: 'أقسام', statMin: 'غرام كحد أدنى', stepsTitle: 'الطلب سهل',
  step1t: 'اختر', step1: 'القطعة والوزن وطريقة التقطيع.',
  step2t: 'أرسل', step2: 'يصل طلبك مباشرة إلى جزارك.',
  step3t: 'التأكيد', step3: 'نؤكد لك الطلب عبر واتساب.',
  step4t: 'استلم', step4: 'مرّ لاستلام طلبك من الجزارة.',
};

const DICT: Record<Lang, Record<TKey, string>> = { fr: FR, ar: AR };

const DAY_NAMES: Record<Lang, string[]> = {
  fr: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function savedLang(): Lang {
  try {
    return localStorage.getItem('lang') === 'ar' ? 'ar' : 'fr';
  } catch {
    return 'fr';
  }
}

@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = signal<Lang>(savedLang());

  constructor() {
    effect(() => {
      const l = this.lang();
      document.documentElement.lang = l;
      document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
      try { localStorage.setItem('lang', l); } catch {}
    });
  }

  t(key: TKey): string {
    return DICT[this.lang()][key];
  }

  /** Champ bilingue d'un objet Firestore : name_fr / name_ar, avec repli sur le français. */
  pick(obj: object, field: string): string {
    const o = obj as Record<string, unknown>;
    return (o[`${field}_${this.lang()}`] || o[`${field}_fr`] || '') as string;
  }

  money(n: number) {
    return `${formatNumber(n)} ${this.t('currency')}`;
  }

  /** Total d'un panier : un article sans prix empêche d'annoncer un montant final. */
  total(amount: number, pending: boolean) {
    if (!pending) return this.money(amount);
    return amount ? `${this.money(amount)} + ${this.t('toConfirm')}` : this.t('toConfirm');
  }

  weight(grams: number) {
    return formatWeight(Math.round(grams), this.t('gr'), this.t('kg'));
  }

  /** Annonce de retour d'un produit épuisé. Une date passée n'est plus annoncée. */
  comeback(p: Product) {
    const d = p.restockDate ? new Date(`${p.restockDate}T00:00`) : null;
    if (!d || isNaN(d.getTime()) || d < startOfToday()) return this.t('backSoon');
    const day = d.toLocaleDateString(this.lang() === 'ar' ? 'ar-DZ' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return this.t('backOn').replace('{d}', day);
  }

  /** Horaires de la semaine pour le site, jours groupés */
  hoursLines(schedule: DaySchedule[]) {
    const name = (d: number) => DAY_NAMES[this.lang()][d];
    return scheduleLines(schedule).map(l => ({
      days: l.first === l.last ? name(l.first) : `${name(l.first)} – ${name(l.last)}`,
      hours: l.open ? `${l.from} – ${l.to}` : this.t('closedDay'),
    }));
  }

  /** Motif d'une fermeture et moment de la reprise */
  closedMessage(s: OrderingState) {
    if (!s.reopens) return [s.note, this.t('closedPaused')].filter(Boolean).join(' — ');
    const today = algeriaClock(new Date()).date;
    const tomorrow = new Date(`${today}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const { date, time } = s.reopens;
    const day = date === today ? this.t('closedToday')
      : date === tomorrow.toISOString().slice(0, 10) ? this.t('closedTomorrow')
      : new Date(`${date}T12:00:00Z`).toLocaleDateString(this.lang() === 'ar' ? 'ar-DZ' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    return [s.note, this.t('closedBack').replace('{d}', day).replace('{t}', time)].filter(Boolean).join(' — ');
  }

  /** Pays d'un produit avec leur drapeau, vide pour un pays écrit à la main */
  countries(p: Product) {
    const inSale = availableOrigins(p);
    return (inSale.length ? inSale : originsOf(p)).map(o => ({ flag: countryFlag(o.country), name: this.country(o.country) }));
  }

  /** Étiquette de gras, vide si le produit n'en a pas */
  fat(p: Product) {
    return p.fat ? FAT_LABELS[p.fat][this.lang()] : '';
  }

  /** Pays dans la langue du client */
  country(origin: string) {
    return countryName(origin, this.lang());
  }

  /** Prix affiché sur un produit : au kg, à la pièce ou sur commande. */
  price(p: Product) {
    if (p.custom) return this.t('customPrice');
    if (p.unit === 'order' || !p.price) return this.t('onOrder');
    const amount = `${formatNumber(lowestPrice(p))} ${p.unit === 'piece' ? this.t('perPiece') : this.t('perKg')}`;
    return hasPriceRange(p) ? `${this.t('priceFrom')} ${amount}` : amount;
  }

  toggle() {
    this.lang.update(l => (l === 'ar' ? 'fr' : 'ar'));
  }
}
