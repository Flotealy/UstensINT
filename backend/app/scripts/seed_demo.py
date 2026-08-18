"""
Script de peuplement de données de démonstration pour Cook'It (UstensINT).
Crée un inventaire complet, des catégories, du stock club et des réservations de test.
"""

import asyncio
from datetime import date, timedelta
import random

from sqlalchemy import select
from app.database import async_session
from app.models.category import Category
from app.models.equipment import Equipment
from app.models.stock import ClubStock
from app.models.user import User
from app.models.reservation import Reservation, ReservationItem
from app.models.setting import Setting


DEMO_CATEGORIES = [
    {"name": "Cuisson", "description": "Poêles, casseroles, faitouts, woks, cocottes"},
    {"name": "Électroménager", "description": "Appareils à raclette, crêpières, gaufriers, robots, blenders"},
    {"name": "Préparation", "description": "Couteaux de chef, planches, mandolines, balances, bols inox"},
    {"name": "Pâtisserie", "description": "Moules, siphons, fouets, poches à douille, chalumeaux"},
    {"name": "Service & Événement", "description": "Fontaines à chocolat, tireuses à bière, chafing dishes, plateaux"},
    {"name": "Spécialités du Monde", "description": "Plats à tajine, cuiseurs à riz, machines à pâtes fraîches"},
]

DEMO_EQUIPMENT = [
    # --- Électroménager ---
    {
        "name": "Appareil à Raclette 8 personnes Tefal",
        "label": "COOK-RAC-001",
        "category_name": "Électroménager",
        "location": "Local Cook'It — Étagère Électro",
        "purchase_cost": 59.99,
        "deposit_amount": 20.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
        "comments": "Fourni avec 8 poêlons et 8 spatules en bois. Nettoyer la plaque sans éponge abrasive.",
    },
    {
        "name": "Appareil à Raclette 8 personnes Tefal (n°2)",
        "label": "COOK-RAC-002",
        "category_name": "Électroménager",
        "location": "Local Cook'It — Étagère Électro",
        "purchase_cost": 59.99,
        "deposit_amount": 20.00,
        "status": "Neuf",
        "photo_url": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
        "comments": "Complet avec 8 poêlons neufs.",
    },
    {
        "name": "Appareil à Fondue Électrique Inox 8 pers.",
        "label": "COOK-FON-001",
        "category_name": "Électroménager",
        "location": "Local Cook'It — Étagère Électro",
        "purchase_cost": 49.90,
        "deposit_amount": 15.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&auto=format&fit=crop&q=80",
        "comments": "Livré avec 8 fourchettes numérotées et collerette anti-éclaboussures.",
    },
    {
        "name": "Crêpière Party 6 mini-crêpes Tefal",
        "label": "COOK-CREP-001",
        "category_name": "Électroménager",
        "location": "Local Cook'It — Étagère Électro",
        "purchase_cost": 65.00,
        "deposit_amount": 20.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1519676867240-f03562e64548?w=600&auto=format&fit=crop&q=80",
        "comments": "Idéal pour soirées crêpes en groupe. 6 mini-spatules et louche doseuse incluses.",
    },
    {
        "name": "Gaufrier Rotatif Réversible Professionnel",
        "label": "COOK-GAUF-001",
        "category_name": "Électroménager",
        "location": "Local Cook'It — Étagère Électro",
        "purchase_cost": 89.00,
        "deposit_amount": 25.00,
        "status": "Neuf",
        "photo_url": "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&auto=format&fit=crop&q=80",
        "comments": "Plaques en fonte d'aluminium amovibles. Poignée thermo-isolante.",
    },
    {
        "name": "Robot Pâtissier Multifonction 5L",
        "label": "COOK-ROB-001",
        "category_name": "Électroménager",
        "location": "Local Cook'It — Placard Sécurisé",
        "purchase_cost": 299.00,
        "deposit_amount": 80.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1594385208974-2e75f8d7bb48?w=600&auto=format&fit=crop&q=80",
        "comments": "Fourni avec fouet ballon, crochet pétrisseur et batteur plat (feuille).",
    },
    {
        "name": "Blender Haute Vitesse en Verre 1.5L",
        "label": "COOK-BLEN-001",
        "category_name": "Électroménager",
        "location": "Local Cook'It — Étagère Électro",
        "purchase_cost": 45.00,
        "deposit_amount": 15.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&auto=format&fit=crop&q=80",
        "comments": "Bol en verre thermorésistant, fonction glace pilée et smoothies.",
    },
    {
        "name": "Mixeur Plongeant & Hachoir 800W",
        "label": "COOK-MIX-001",
        "category_name": "Électroménager",
        "location": "Local Cook'It — Tiroir Petits Appareils",
        "purchase_cost": 39.90,
        "deposit_amount": 10.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&auto=format&fit=crop&q=80",
        "comments": "Pied inox amovible + bol hachoir 500ml + fouet.",
    },
    {
        "name": "Machine à Panini & Grill Réversible",
        "label": "COOK-GRILL-001",
        "category_name": "Électroménager",
        "location": "Local Cook'It — Étagère Électro",
        "purchase_cost": 55.00,
        "deposit_amount": 20.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80",
        "comments": "Ouverture à 180° pour mode plancha. Bac récupérateur de graisses.",
    },

    # --- Cuisson ---
    {
        "name": "Set de 3 Poêles Antiadhésives Tefal 20/24/28cm",
        "label": "COOK-POE-001",
        "category_name": "Cuisson",
        "location": "Local Cook'It — Étagère Batterie",
        "purchase_cost": 69.90,
        "deposit_amount": 15.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1584990347449-34b9d0383794?w=600&auto=format&fit=crop&q=80",
        "comments": "Compatible tous feux dont induction. Ne pas utiliser d'ustensiles métalliques.",
    },
    {
        "name": "Cocotte en Fonte Émaillée 28cm (6L)",
        "label": "COOK-COC-001",
        "category_name": "Cuisson",
        "location": "Local Cook'It — Étagère Batterie",
        "purchase_cost": 110.00,
        "deposit_amount": 35.00,
        "status": "Neuf",
        "photo_url": "https://images.unsplash.com/photo-1585837575652-267c041d77d4?w=600&auto=format&fit=crop&q=80",
        "comments": "Parfait pour les plats mijotés, ragoûts et pains cocotte.",
    },
    {
        "name": "Grand Faitout Inox 12 Litres Traiteur",
        "label": "COOK-FAIT-001",
        "category_name": "Cuisson",
        "location": "Local Cook'It — Étagère Basse",
        "purchase_cost": 75.00,
        "deposit_amount": 20.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&auto=format&fit=crop&q=80",
        "comments": "Idéal pour les repas de promo, soupes et cuisson grande quantité de pâtes.",
    },
    {
        "name": "Wok Traditionnel en Fonte 32cm + Grille",
        "label": "COOK-WOK-001",
        "category_name": "Cuisson",
        "location": "Local Cook'It — Étagère Batterie",
        "purchase_cost": 45.00,
        "deposit_amount": 15.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1514326640560-7d063ef2aed5?w=600&auto=format&fit=crop&q=80",
        "comments": "Fourni avec couvercle bombé en verre et grille demi-lune égouttoir.",
    },

    # --- Préparation ---
    {
        "name": "Mallette de 5 Couteaux de Chef Japonais",
        "label": "COOK-COUT-001",
        "category_name": "Préparation",
        "location": "Local Cook'It — Placard Sécurisé",
        "purchase_cost": 120.00,
        "deposit_amount": 40.00,
        "status": "Neuf",
        "photo_url": "https://images.unsplash.com/photo-1593618998160-e34014e67546?w=600&auto=format&fit=crop&q=80",
        "comments": "Santoku, Chef, Nakiri, Office et Pain. Lavage à la main obligatoire, essuyer immédiatement.",
    },
    {
        "name": "Mandoline Japonaise Professionnelle Benriner",
        "label": "COOK-MAND-001",
        "category_name": "Préparation",
        "location": "Local Cook'It — Tiroir Préparation",
        "purchase_cost": 48.00,
        "deposit_amount": 15.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1584269600519-112d071b35e6?w=600&auto=format&fit=crop&q=80",
        "comments": "3 lames julienne interchangeables. TOUJOURS utiliser le poussoir de sécurité.",
    },
    {
        "name": "Set de 3 Bacs / Cul-de-poule Inox avec Socle Silicone",
        "label": "COOK-CUL-001",
        "category_name": "Préparation",
        "location": "Local Cook'It — Étagère Bols",
        "purchase_cost": 29.90,
        "deposit_amount": 10.00,
        "status": "Neuf",
        "photo_url": "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&auto=format&fit=crop&q=80",
        "comments": "Tailles 1.5L, 3L et 5L. Base antidérapante en silicone bleu.",
    },
    {
        "name": "Balance de Précision Pâtissière 0.1g",
        "label": "COOK-BAL-001",
        "category_name": "Préparation",
        "location": "Local Cook'It — Tiroir Mesures",
        "purchase_cost": 22.00,
        "deposit_amount": 5.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&auto=format&fit=crop&q=80",
        "comments": "Capacité max 3 kg. Fonction tare et conversion g / oz / ml.",
    },

    # --- Pâtisserie ---
    {
        "name": "Siphon à Chantilly Inox Pro 0.5L",
        "label": "COOK-SIPH-001",
        "category_name": "Pâtisserie",
        "location": "Local Cook'It — Placard Pâtisserie",
        "purchase_cost": 49.00,
        "deposit_amount": 15.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=80",
        "comments": "Adapté préparations chaudes et froides. 3 douilles décoratives incluses.",
    },
    {
        "name": "Chalumeau de Cuisine Pro + Recharges Gaz",
        "label": "COOK-CHAL-001",
        "category_name": "Pâtisserie",
        "location": "Local Cook'It — Tiroir Pâtisserie",
        "purchase_cost": 25.00,
        "deposit_amount": 10.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80",
        "comments": "Pour crèmes brûlées, meringues et gratiner. Allumage piézoélectrique.",
    },
    {
        "name": "Set de 3 Moules à Charnière Antiadhésifs (20/24/28cm)",
        "label": "COOK-MOUL-001",
        "category_name": "Pâtisserie",
        "location": "Local Cook'It — Placard Pâtisserie",
        "purchase_cost": 32.00,
        "deposit_amount": 10.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=80",
        "comments": "Démoulage facile pour cheesecakes, génoises et gâteaux hauts.",
    },

    # --- Spécialités du Monde ---
    {
        "name": "Machine à Pâtes Fraîches Manuelle en Inox",
        "label": "COOK-PAT-001",
        "category_name": "Spécialités du Monde",
        "location": "Local Cook'It — Placard Spécialités",
        "purchase_cost": 55.00,
        "deposit_amount": 20.00,
        "status": "Neuf",
        "photo_url": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&auto=format&fit=crop&q=80",
        "comments": "Rouleaux réglables 9 épaisseurs + bloc découpe tagliatelles et fettuccine.",
    },
    {
        "name": "Cuiseur à Riz Japonais Automatique 1.8L",
        "label": "COOK-RIZ-001",
        "category_name": "Spécialités du Monde",
        "location": "Local Cook'It — Étagère Électro",
        "purchase_cost": 42.00,
        "deposit_amount": 15.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?w=600&auto=format&fit=crop&q=80",
        "comments": "Maintien au chaud automatique. Bol gradué avec verre doseur et spatule riz.",
    },
    {
        "name": "Plat à Tajine Traditionnel en Terre Cuite Émaillée",
        "label": "COOK-TAJ-001",
        "category_name": "Spécialités du Monde",
        "location": "Local Cook'It — Étagère Batterie",
        "purchase_cost": 38.00,
        "deposit_amount": 15.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=600&auto=format&fit=crop&q=80",
        "comments": "Diamètre 30cm (4 à 6 personnes). Cuisson lente et savoureuse.",
    },

    # --- Service & Événement ---
    {
        "name": "Fontaine à Chocolat 3 Étages pour Soirées",
        "label": "COOK-FONT-001",
        "category_name": "Service & Événement",
        "location": "Local Cook'It — Étagère Événement",
        "purchase_cost": 65.00,
        "deposit_amount": 25.00,
        "status": "Neuf",
        "photo_url": "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=600&auto=format&fit=crop&q=80",
        "comments": "Capacité 1kg de chocolat fondu. Utiliser du chocolat spécial fontaine ou avec huile.",
    },
    {
        "name": "Tireuse à Bière / Pompe à Fût Universelle",
        "label": "COOK-TIR-001",
        "category_name": "Service & Événement",
        "location": "Local Cook'It — Placard Sécurisé",
        "purchase_cost": 169.00,
        "deposit_amount": 50.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&auto=format&fit=crop&q=80",
        "comments": "Compatible fûts pressurisés 5L (Beertender). Système de refroidissement intégré.",
    },
    {
        "name": "Chafing Dish Inox Chauffe-Plat Buffet (Bain-Marie)",
        "label": "COOK-CHAF-001",
        "category_name": "Service & Événement",
        "location": "Local Cook'It — Étagère Événement",
        "purchase_cost": 59.00,
        "deposit_amount": 20.00,
        "status": "Bon état",
        "photo_url": "https://images.unsplash.com/photo-1555244162-803834f70033?w=600&auto=format&fit=crop&q=80",
        "comments": "Bac GN 1/1 9L. 2 brûleurs à pâte combustible inclus.",
    },
]

DEMO_STOCK = [
    {"name": "Farine de Blé T55", "category": "Ingrédients Secs", "quantity": 12.0, "unit": "kg", "min_threshold": 3.0, "location": "Étagère Stock Sec"},
    {"name": "Sucre Blanc en Poudre", "category": "Ingrédients Secs", "quantity": 8.0, "unit": "kg", "min_threshold": 2.0, "location": "Étagère Stock Sec"},
    {"name": "Sucre Glace", "category": "Ingrédients Secs", "quantity": 3.5, "unit": "kg", "min_threshold": 1.0, "location": "Étagère Stock Sec"},
    {"name": "Huile de Tournesol", "category": "Huiles & Condiments", "quantity": 6.0, "unit": "L", "min_threshold": 2.0, "location": "Placard Condiments"},
    {"name": "Huile d'Olive Vierge Extra", "category": "Huiles & Condiments", "quantity": 4.0, "unit": "L", "min_threshold": 1.5, "location": "Placard Condiments"},
    {"name": "Levure Chimique (Alsa)", "category": "Pâtisserie", "quantity": 35.0, "unit": "sachets", "min_threshold": 10.0, "location": "Boîte Pâtisserie"},
    {"name": "Sucre Vanillé", "category": "Pâtisserie", "quantity": 40.0, "unit": "sachets", "min_threshold": 15.0, "location": "Boîte Pâtisserie"},
    {"name": "Pépites de Chocolat Noir 50%", "category": "Pâtisserie", "quantity": 2.5, "unit": "kg", "min_threshold": 1.0, "location": "Boîte Pâtisserie"},
    {"name": "Rouleaux de Papier Cuisson", "category": "Consommables", "quantity": 8.0, "unit": "rouleaux", "min_threshold": 2.0, "location": "Tiroir Fournitures"},
    {"name": "Rouleaux d'Aluminium Alimentaire", "category": "Consommables", "quantity": 6.0, "unit": "rouleaux", "min_threshold": 2.0, "location": "Tiroir Fournitures"},
    {"name": "Film Étirable Alimentaire 300m", "category": "Consommables", "quantity": 4.0, "unit": "rouleaux", "min_threshold": 2.0, "location": "Tiroir Fournitures"},
    {"name": "Liquide Vaisselle Écologique", "category": "Entretien", "quantity": 5.0, "unit": "L", "min_threshold": 1.5, "location": "Sous-évier Local"},
    {"name": "Éponges double face avec grattoir", "category": "Entretien", "quantity": 16.0, "unit": "unités", "min_threshold": 4.0, "location": "Sous-évier Local"},
    {"name": "Sacs Poubelle 50L renforcés", "category": "Entretien", "quantity": 45.0, "unit": "unités", "min_threshold": 15.0, "location": "Local Cook'It"},
]


async def seed_demo_data() -> None:
    print("🌱 Démarrage de la génération des données de démo Cook'It...")

    async with async_session() as session:
        # 1. Catégories
        category_map = {}
        for cat_data in DEMO_CATEGORIES:
            res = await session.execute(select(Category).where(Category.name == cat_data["name"]))
            cat = res.scalar_one_or_none()
            if not cat:
                cat = Category(name=cat_data["name"], description=cat_data["description"])
                session.add(cat)
                await session.flush()
                await session.refresh(cat)
                print(f"  + Catégorie créée : {cat.name}")
            category_map[cat.name] = cat.id

        await session.commit()

        # 2. Matériel & Ustensiles
        equipment_created = 0
        equipment_list = []
        for eq_data in DEMO_EQUIPMENT:
            res = await session.execute(select(Equipment).where(Equipment.label == eq_data["label"]))
            existing = res.scalar_one_or_none()
            cat_id = category_map.get(eq_data["category_name"])

            if not existing and cat_id:
                eq = Equipment(
                    name=eq_data["name"],
                    label=eq_data["label"],
                    category_id=cat_id,
                    location=eq_data["location"],
                    purchase_cost=eq_data["purchase_cost"],
                    deposit_amount=eq_data["deposit_amount"],
                    status=eq_data["status"],
                    photo_url=eq_data["photo_url"],
                    comments=eq_data["comments"],
                )
                session.add(eq)
                equipment_list.append(eq)
                equipment_created += 1

        await session.commit()
        print(f"✅ {equipment_created} fiches matériel créées avec photos HD et étiquettes.")

        # 3. Stock Consommables
        stock_created = 0
        for stock_data in DEMO_STOCK:
            res = await session.execute(select(ClubStock).where(ClubStock.name == stock_data["name"]))
            if not res.scalar_one_or_none():
                item = ClubStock(
                    name=stock_data["name"],
                    category=stock_data["category"],
                    quantity=stock_data["quantity"],
                    unit=stock_data["unit"],
                    min_threshold=stock_data["min_threshold"],
                    location=stock_data["location"],
                )
                session.add(item)
                stock_created += 1

        await session.commit()
        print(f"✅ {stock_created} consommables ajoutés au stock club.")

        # 4. Étudiants de test & Réservations de démo
        demo_users = [
            ("thomas.bernard@telecom-sudparis.eu", "Thomas Bernard"),
            ("lea.martin@telecom-sudparis.eu", "Léa Martin"),
            ("alexandre.dubois@telecom-sudparis.eu", "Alexandre Dubois"),
        ]

        created_users = []
        for email, name in demo_users:
            res = await session.execute(select(User).where(User.email == email))
            u = res.scalar_one_or_none()
            if not u:
                u = User(email=email, display_name=name, role="user")
                session.add(u)
                await session.flush()
                await session.refresh(u)
            created_users.append(u)

        await session.commit()

        # Récupérer quelques matériels pour créer 3 réservations réalistes
        all_eq_res = await session.execute(select(Equipment).where(Equipment.is_archived == False).limit(6))
        all_eq = list(all_eq_res.scalars().all())

        if len(all_eq) >= 3 and created_users:
            # Réservation 1 : En cours (Approuvée)
            r1 = Reservation(
                user_id=created_users[0].id,
                status="approved",
                start_date=date.today() - timedelta(days=2),
                end_date=date.today() + timedelta(days=3),
                total_deposit=float(all_eq[0].deposit_amount or 0),
                phone="06 12 34 56 78",
                comments="Soirée raclette d'étage en résidence.",
                staff_comment="Caution 20€ vérifiée.",
            )
            session.add(r1)
            await session.flush()
            session.add(ReservationItem(reservation_id=r1.id, equipment_id=all_eq[0].id, deposit_amount=all_eq[0].deposit_amount))

            # Réservation 2 : En attente de validation (Active)
            r2 = Reservation(
                user_id=created_users[1].id,
                status="active",
                start_date=date.today() + timedelta(days=1),
                end_date=date.today() + timedelta(days=5),
                total_deposit=float(all_eq[1].deposit_amount or 0),
                phone="07 98 76 54 32",
                comments="Atelier pâtisserie pour l'anniversaire d'une amie.",
            )
            session.add(r2)
            await session.flush()
            session.add(ReservationItem(reservation_id=r2.id, equipment_id=all_eq[1].id, deposit_amount=all_eq[1].deposit_amount))

            await session.commit()
            print("✅ Réservations de démonstration générées (en cours & en attente).")

    print("\n🎉 Peuplement de démonstration terminé avec succès !")


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
