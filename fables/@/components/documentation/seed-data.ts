// ════════════════════════════════════════════════════════════════════════════
// seed-data.ts — Base 2014 D&D entries for initial import to documentation table
// Each entry's `data` field is structured for character autofill
// ════════════════════════════════════════════════════════════════════════════

import type { DocSingular } from "./doc-types"

interface SeedEntry {
  id: string
  name: string
  description: string
  data: Record<string, any>
}

export const SEED_DATA: Record<DocSingular, SeedEntry[]> = {
  // ── Classes ──────────────────────────────────────────────────────────────
  // data fields used for character autofill:
  //   hit_die → hit dice pool
  //   primary_abilities → tooltip/hint
  //   saving_throws → savingThrowProfs
  //   armor_proficiencies → armorProfs
  //   weapon_proficiencies → weaponProfs
  //   spellcasting_ability → spellcastingAbility
  //   spellcasting_type → "full"|"half"|"third"|"pact"|null
  class: [
    { id:"artificer", name:"Artificer", description:"d8 · Intelligence",
      data:{ hit_die:"d8", primary_abilities:["Intelligence"], saving_throws:["con","int"],
             armor_proficiencies:["Light","Medium","Shields"], weapon_proficiencies:["Simple"],
             spellcasting_ability:"int", spellcasting_type:"half" }},
    { id:"barbarian", name:"Barbarian", description:"d12 · Strength",
      data:{ hit_die:"d12", primary_abilities:["Strength"], saving_throws:["str","con"],
             armor_proficiencies:["Light","Medium","Shields"], weapon_proficiencies:["Simple","Martial"],
             spellcasting_ability:null, spellcasting_type:null }},
    { id:"bard", name:"Bard", description:"d8 · Charisma",
      data:{ hit_die:"d8", primary_abilities:["Charisma"], saving_throws:["dex","cha"],
             armor_proficiencies:["Light"], weapon_proficiencies:["Simple","Hand Crossbows","Longswords","Rapiers","Shortswords"],
             spellcasting_ability:"cha", spellcasting_type:"full" }},
    { id:"cleric", name:"Cleric", description:"d8 · Wisdom",
      data:{ hit_die:"d8", primary_abilities:["Wisdom"], saving_throws:["wis","cha"],
             armor_proficiencies:["Light","Medium","Shields"], weapon_proficiencies:["Simple"],
             spellcasting_ability:"wis", spellcasting_type:"full" }},
    { id:"druid", name:"Druid", description:"d8 · Wisdom",
      data:{ hit_die:"d8", primary_abilities:["Wisdom"], saving_throws:["int","wis"],
             armor_proficiencies:["Light","Medium","Shields (non-metal)"], weapon_proficiencies:["Clubs","Daggers","Darts","Javelins","Maces","Quarterstaffs","Scimitars","Sickles","Slings","Spears"],
             spellcasting_ability:"wis", spellcasting_type:"full" }},
    { id:"fighter", name:"Fighter", description:"d10 · Strength or Dex",
      data:{ hit_die:"d10", primary_abilities:["Strength","Dexterity"], saving_throws:["str","con"],
             armor_proficiencies:["Light","Medium","Heavy","Shields"], weapon_proficiencies:["Simple","Martial"],
             spellcasting_ability:null, spellcasting_type:null }},
    { id:"monk", name:"Monk", description:"d8 · Dexterity & Wisdom",
      data:{ hit_die:"d8", primary_abilities:["Dexterity","Wisdom"], saving_throws:["str","dex"],
             armor_proficiencies:[], weapon_proficiencies:["Simple","Shortswords"],
             spellcasting_ability:null, spellcasting_type:null }},
    { id:"paladin", name:"Paladin", description:"d10 · Strength & Charisma",
      data:{ hit_die:"d10", primary_abilities:["Strength","Charisma"], saving_throws:["wis","cha"],
             armor_proficiencies:["Light","Medium","Heavy","Shields"], weapon_proficiencies:["Simple","Martial"],
             spellcasting_ability:"cha", spellcasting_type:"half" }},
    { id:"ranger", name:"Ranger", description:"d10 · Dexterity & Wisdom",
      data:{ hit_die:"d10", primary_abilities:["Dexterity","Wisdom"], saving_throws:["str","dex"],
             armor_proficiencies:["Light","Medium","Shields"], weapon_proficiencies:["Simple","Martial"],
             spellcasting_ability:"wis", spellcasting_type:"half" }},
    { id:"rogue", name:"Rogue", description:"d8 · Dexterity",
      data:{ hit_die:"d8", primary_abilities:["Dexterity"], saving_throws:["dex","int"],
             armor_proficiencies:["Light"], weapon_proficiencies:["Simple","Hand Crossbows","Longswords","Rapiers","Shortswords"],
             spellcasting_ability:null, spellcasting_type:null }},
    { id:"sorcerer", name:"Sorcerer", description:"d6 · Charisma",
      data:{ hit_die:"d6", primary_abilities:["Charisma"], saving_throws:["con","cha"],
             armor_proficiencies:[], weapon_proficiencies:["Daggers","Darts","Slings","Quarterstaffs","Light Crossbows"],
             spellcasting_ability:"cha", spellcasting_type:"full" }},
    { id:"warlock", name:"Warlock", description:"d8 · Charisma",
      data:{ hit_die:"d8", primary_abilities:["Charisma"], saving_throws:["wis","cha"],
             armor_proficiencies:["Light"], weapon_proficiencies:["Simple"],
             spellcasting_ability:"cha", spellcasting_type:"pact" }},
    { id:"wizard", name:"Wizard", description:"d6 · Intelligence",
      data:{ hit_die:"d6", primary_abilities:["Intelligence"], saving_throws:["int","wis"],
             armor_proficiencies:[], weapon_proficiencies:["Daggers","Darts","Slings","Quarterstaffs","Light Crossbows"],
             spellcasting_ability:"int", spellcasting_type:"full" }},
  ],

  // ── Races ────────────────────────────────────────────────────────────────
  // data fields used for character autofill:
  //   speed → character.speed
  //   size → display
  //   darkvision → added to racialTraits
  //   ability_bonuses → added to ability scores
  //   languages → languageProfs
  //   traits[] → racialTraits (names seeded as Feature entries)
  race: [
    { id:"dragonborn", name:"Dragonborn", description:"Str +2 · Cha +1",
      data:{ speed:30, size:"Medium", darkvision:0,
             ability_bonuses:{str:2,dex:0,con:0,int:0,wis:0,cha:1},
             languages:["Common","Draconic"],
             traits:["Draconic Ancestry","Breath Weapon","Damage Resistance"] }},
    { id:"dwarf-hill", name:"Dwarf (Hill)", description:"Con +2 · Wis +1",
      data:{ speed:25, size:"Medium", darkvision:60,
             ability_bonuses:{str:0,dex:0,con:2,int:0,wis:1,cha:0},
             languages:["Common","Dwarvish"],
             traits:["Darkvision","Dwarven Resilience","Dwarven Combat Training","Tool Proficiency","Stonecunning","Dwarven Toughness"] }},
    { id:"dwarf-mountain", name:"Dwarf (Mountain)", description:"Con +2 · Str +2",
      data:{ speed:25, size:"Medium", darkvision:60,
             ability_bonuses:{str:2,dex:0,con:2,int:0,wis:0,cha:0},
             languages:["Common","Dwarvish"],
             traits:["Darkvision","Dwarven Resilience","Dwarven Combat Training","Dwarven Armor Training","Stonecunning"] }},
    { id:"elf-high", name:"Elf (High)", description:"Dex +2 · Int +1",
      data:{ speed:30, size:"Medium", darkvision:60,
             ability_bonuses:{str:0,dex:2,con:0,int:1,wis:0,cha:0},
             languages:["Common","Elvish","one extra"],
             traits:["Darkvision","Keen Senses","Fey Ancestry","Trance","Elf Weapon Training","Cantrip","Extra Language"] }},
    { id:"elf-wood", name:"Elf (Wood)", description:"Dex +2 · Wis +1",
      data:{ speed:35, size:"Medium", darkvision:60,
             ability_bonuses:{str:0,dex:2,con:0,int:0,wis:1,cha:0},
             languages:["Common","Elvish"],
             traits:["Darkvision","Keen Senses","Fey Ancestry","Trance","Elf Weapon Training","Fleet of Foot","Mask of the Wild"] }},
    { id:"elf-dark", name:"Elf (Dark)", description:"Dex +2 · Cha +1",
      data:{ speed:30, size:"Medium", darkvision:120,
             ability_bonuses:{str:0,dex:2,con:0,int:0,wis:0,cha:1},
             languages:["Common","Elvish","Undercommon"],
             traits:["Superior Darkvision","Keen Senses","Fey Ancestry","Trance","Sunlight Sensitivity","Drow Magic","Drow Weapon Training"] }},
    { id:"gnome-forest", name:"Gnome (Forest)", description:"Int +2 · Dex +1",
      data:{ speed:25, size:"Small", darkvision:60,
             ability_bonuses:{str:0,dex:1,con:0,int:2,wis:0,cha:0},
             languages:["Common","Gnomish"],
             traits:["Darkvision","Gnome Cunning","Natural Illusionist","Speak with Animals"] }},
    { id:"gnome-rock", name:"Gnome (Rock)", description:"Int +2 · Con +1",
      data:{ speed:25, size:"Small", darkvision:60,
             ability_bonuses:{str:0,dex:0,con:1,int:2,wis:0,cha:0},
             languages:["Common","Gnomish"],
             traits:["Darkvision","Gnome Cunning","Artificer's Lore","Tinker"] }},
    { id:"half-elf", name:"Half-Elf", description:"Cha +2 · Two others +1",
      data:{ speed:30, size:"Medium", darkvision:60,
             ability_bonuses:{str:0,dex:0,con:0,int:0,wis:0,cha:2},
             languages:["Common","Elvish","one extra"],
             traits:["Darkvision","Fey Ancestry","Skill Versatility"] }},
    { id:"half-orc", name:"Half-Orc", description:"Str +2 · Con +1",
      data:{ speed:30, size:"Medium", darkvision:60,
             ability_bonuses:{str:2,dex:0,con:1,int:0,wis:0,cha:0},
             languages:["Common","Orc"],
             traits:["Darkvision","Menacing","Relentless Endurance","Savage Attacks"] }},
    { id:"halfling-lightfoot", name:"Halfling (Lightfoot)", description:"Dex +2 · Cha +1",
      data:{ speed:25, size:"Small", darkvision:0,
             ability_bonuses:{str:0,dex:2,con:0,int:0,wis:0,cha:1},
             languages:["Common","Halfling"],
             traits:["Lucky","Brave","Halfling Nimbleness","Naturally Stealthy"] }},
    { id:"halfling-stout", name:"Halfling (Stout)", description:"Dex +2 · Con +1",
      data:{ speed:25, size:"Small", darkvision:0,
             ability_bonuses:{str:0,dex:2,con:1,int:0,wis:0,cha:0},
             languages:["Common","Halfling"],
             traits:["Lucky","Brave","Halfling Nimbleness","Stout Resilience"] }},
    { id:"human", name:"Human", description:"All abilities +1",
      data:{ speed:30, size:"Medium", darkvision:0,
             ability_bonuses:{str:1,dex:1,con:1,int:1,wis:1,cha:1},
             languages:["Common","one extra"],
             traits:[] }},
    { id:"tiefling", name:"Tiefling", description:"Int +1 · Cha +2",
      data:{ speed:30, size:"Medium", darkvision:60,
             ability_bonuses:{str:0,dex:0,con:0,int:1,wis:0,cha:2},
             languages:["Common","Infernal"],
             traits:["Darkvision","Hellish Resistance","Infernal Legacy"] }},
  ],

  // ── Feats ────────────────────────────────────────────────────────────────
  // data fields used for character autofill:
  //   prerequisite → display note
  //   asi.ability + asi.amount → ability score bump
  //   benefits[] → added to character feats description
  feat: [
    { id:"alert", name:"Alert", description:"+5 Initiative, can't be surprised",
      data:{ prerequisite:"None", asi:null,
             benefits:["Gain +5 bonus to initiative","Can't be surprised while conscious","Hidden attackers gain no advantage on rolls vs you"] }},
    { id:"charger", name:"Charger", description:"Dash then bonus attack",
      data:{ prerequisite:"None", asi:null,
             benefits:["After Dash action, use bonus action for a melee attack or shove","If you moved 10+ feet straight toward target: +5 damage or push 10 ft"] }},
    { id:"crossbow-expert", name:"Crossbow Expert", description:"Crossbow mastery",
      data:{ prerequisite:"None", asi:null,
             benefits:["Ignore Loading property on crossbows you're proficient with","No disadvantage on ranged attacks while within 5 ft of hostile creature","Bonus action attack with hand crossbow after attacking with one-handed weapon"] }},
    { id:"dual-wielder", name:"Dual Wielder", description:"Two-weapon fighting",
      data:{ prerequisite:"None", asi:null,
             benefits:["+1 bonus to AC while wielding a melee weapon in each hand","Can use two-weapon fighting with non-light weapons","Can draw/stow two one-handed weapons per turn"] }},
    { id:"durable", name:"Durable", description:"Con +1 · better Hit Dice rolls",
      data:{ prerequisite:"None", asi:{ability:"con",amount:1},
             benefits:["Increase Constitution by 1 (max 20)","Minimum HP regained from Hit Dice equals 2× your CON modifier"] }},
    { id:"great-weapon-master", name:"Great Weapon Master", description:"Power attacks with heavy weapons",
      data:{ prerequisite:"None", asi:null,
             benefits:["On critical hit or killing blow with melee, make one bonus melee attack","Take -5 to attack with heavy weapon for +10 damage"] }},
    { id:"lucky", name:"Lucky", description:"3 luck points per long rest",
      data:{ prerequisite:"None", asi:null,
             benefits:["3 luck points per long rest","Spend one to roll extra d20 on any attack/check/save — choose which roll to use","Spend one to force attacker to use your d20 roll vs you"] }},
    { id:"magic-initiate", name:"Magic Initiate", description:"2 cantrips + 1 1st-level spell",
      data:{ prerequisite:"None", asi:null,
             benefits:["Choose a class: bard, cleric, druid, sorcerer, warlock, or wizard","Learn 2 cantrips from that class's list","Learn 1st-level spell from that list, castable once per long rest"] }},
    { id:"mobile", name:"Mobile", description:"+10 ft speed, ignore difficult terrain after Dash",
      data:{ prerequisite:"None", asi:null,
             benefits:["Speed increases by 10 feet","Difficult terrain doesn't slow Dash action","After melee attack vs creature, no opportunity attacks from it this turn"] }},
    { id:"polearm-master", name:"Polearm Master", description:"Bonus attack + extended threat range",
      data:{ prerequisite:"None", asi:null,
             benefits:["Bonus action attack with polearm butt (1d4 bludgeoning)","Creatures entering your reach with a polearm provoke opportunity attacks"] }},
    { id:"resilient", name:"Resilient", description:"+1 ability score + saving throw proficiency",
      data:{ prerequisite:"None", asi:{ability:"choose",amount:1},
             benefits:["Increase one ability score by 1 (max 20)","Gain proficiency in saving throws for that ability"] }},
    { id:"sentinel", name:"Sentinel", description:"Lock down opportunity attacks",
      data:{ prerequisite:"None", asi:null,
             benefits:["Opportunity attacks reduce creature's speed to 0","Creatures provoke OA even if they Disengage","Reaction melee attack when nearby creature attacks someone else"] }},
    { id:"sharpshooter", name:"Sharpshooter", description:"-5/+10 ranged power attack",
      data:{ prerequisite:"None", asi:null,
             benefits:["No disadvantage at long range","Ranged attacks ignore half and three-quarters cover","Take -5 attack penalty for +10 damage with ranged weapons"] }},
    { id:"tough", name:"Tough", description:"+2 HP per level",
      data:{ prerequisite:"None", asi:null,
             benefits:["HP maximum increases by 2 × your level when taken","Each subsequent level adds +2 HP maximum"] }},
    { id:"war-caster", name:"War Caster", description:"Advantage on concentration saves",
      data:{ prerequisite:"Ability to cast at least one spell", asi:null,
             benefits:["Advantage on Constitution saves to maintain concentration","Can perform somatic components with weapons/shield in hand","Can cast a spell as an opportunity attack reaction"] }},
  ],

  // ── Items ────────────────────────────────────────────────────────────────
  // data fields used for character autofill:
  //   rarity, item_type, requires_attunement → item display
  //   ac_bonus, save_bonus → derived stat bonuses
  //   set_stat → override a stat (e.g. STR 19)
  //   description → added to equipment notes
  item: [
    { id:"bag-of-holding", name:"Bag of Holding", description:"Wondrous · Uncommon",
      data:{ rarity:"uncommon", item_type:"wondrous", requires_attunement:false,
             description:"Holds up to 500 lb / 64 cubic feet. Weighs 15 lb regardless of contents." }},
    { id:"boots-of-elvenkind", name:"Boots of Elvenkind", description:"Wondrous · Uncommon",
      data:{ rarity:"uncommon", item_type:"wondrous", requires_attunement:false,
             description:"Steps make no sound. Advantage on Stealth checks relying on moving silently." }},
    { id:"cloak-of-protection", name:"Cloak of Protection", description:"Wondrous · Uncommon (Attune)",
      data:{ rarity:"uncommon", item_type:"wondrous", requires_attunement:true, ac_bonus:1, save_bonus:1,
             description:"+1 bonus to AC and saving throws." }},
    { id:"gauntlets-ogre-power", name:"Gauntlets of Ogre Power", description:"Wondrous · Uncommon (Attune)",
      data:{ rarity:"uncommon", item_type:"wondrous", requires_attunement:true, set_stat:{ability:"str",value:19},
             description:"Strength score becomes 19 while worn (no effect if STR already ≥ 19)." }},
    { id:"ring-of-protection", name:"Ring of Protection", description:"Ring · Rare (Attune)",
      data:{ rarity:"rare", item_type:"ring", requires_attunement:true, ac_bonus:1, save_bonus:1,
             description:"+1 bonus to AC and saving throws." }},
    { id:"staff-of-fire", name:"Staff of Fire", description:"Staff · Very Rare (Attune)",
      data:{ rarity:"very rare", item_type:"staff", requires_attunement:true,
             description:"10 charges. Resistance to fire damage. Cast Burning Hands (1), Fireball (3), or Wall of Fire (4). DC 17." }},
    { id:"sword-of-sharpness", name:"Sword of Sharpness", description:"Weapon · Very Rare (Attune)",
      data:{ rarity:"very rare", item_type:"weapon", requires_attunement:true,
             description:"Max damage dice vs objects. On a 20: +4d6 slashing. Roll again — on another 20, sever a limb." }},
    { id:"vorpal-sword", name:"Vorpal Sword", description:"Weapon · Legendary (Attune)",
      data:{ rarity:"legendary", item_type:"weapon", requires_attunement:true, magic_bonus:3,
             description:"+3 to attack and damage. Ignores slashing resistance. On a natural 20, decapitate." }},
    { id:"wand-magic-missiles", name:"Wand of Magic Missiles", description:"Wand · Uncommon",
      data:{ rarity:"uncommon", item_type:"wand", requires_attunement:false,
             description:"7 charges. Cast Magic Missile at 1st-level (1 charge) or higher (+1 per level). Regains 1d6+1 charges at dawn." }},
  ],
}
