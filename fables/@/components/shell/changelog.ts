// ════════════════════════════════════════════════════════════════════════════
// changelog.ts — "What's New" entries shown from the update-details button
// next to the sidebar toggle (see UpdateDetailsButton.tsx). Newest first.
// ════════════════════════════════════════════════════════════════════════════

export interface ChangelogEntry {
  date: string   // display string, not parsed — e.g. "July 17, 2026"
  title: string
  description: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "August 23, 2026",
    title: "Tracked uses on monster Traits and Actions",
    description: "Any Trait, Action, Bonus Action, Reaction, Legendary Action, Lair Action, or Misc entry on a monster's stat block can now track its own uses (label, max, resets on) — same bar you're used to on Inventory and Martial items.",
  },
  {
    date: "August 23, 2026",
    title: "Pin spells to the top of your list",
    description: "Open a spell's detail view and hit the pin button next to Edit — pinned spells show in a Pinned section right above Cantrips, and still show in their normal spot in the list too.",
  },
  {
    date: "August 23, 2026",
    title: "Custom \"Misc\" section for monster stat blocks",
    description: "Edit Stat Block now has a Misc section with its own editable heading — use it for Mythic Actions or any other custom category that doesn't fit the standard 5e sections.",
  },
  {
    date: "August 23, 2026",
    title: "\"I'm Feeling Lucky\" spell roll now spends a slot",
    description: "Rolling a random spell on a monster's stat block now actually expends a spell slot or daily use for the spell it picks, same as casting it normally would — cantrips and at-will spells still cost nothing.",
  },
  {
    date: "August 23, 2026",
    title: "Adventure Packs",
    description: "Standard equipment packs (Explorer's Pack, Dungeoneer's Pack, etc.) now show up right in the item-name search when adding an item — picking one adds every item inside it individually (10 Torches becomes a Torch stack of 10, not one \"10 Torches\" line). The ordinary adventuring gear list (rope, rations, tools, etc.) got filled in too, so item search actually finds them.",
  },
  {
    date: "August 23, 2026",
    title: "Martial tab items can track uses",
    description: "Weapons on the Martial tab can now have tracked uses (charges, uses/day) just like Inventory items — the uses bar shows on the Martial tab and in Favorites too.",
  },
  {
    date: "August 23, 2026",
    title: "Martial tab and Inventory stay linked",
    description: "Adding a new weapon from the Martial tab now also creates a matching Inventory item automatically, and the \"+ Martial Tab\" link button works from Carried Items now, not just equipped armor. Only weapons can link to the Martial tab.",
  },
  {
    date: "August 22, 2026",
    title: "Share a character read-only",
    description: "Settings → Share Link generates a link that shows anyone a read-only view of your character — no account or party invite needed.",
  },
  {
    date: "August 22, 2026",
    title: "Multiple active Forms",
    description: "Automation → Forms has an \"Allow multiple Forms active at once\" checkbox, so a character can stack more than one active Form instead of just one at a time.",
  },
  {
    date: "August 22, 2026",
    title: "Automation moved before Settings",
    description: "The Automation and Settings buttons on the character sheet header swapped places.",
  },
  {
    date: "August 7, 2026",
    title: "Carrying capacity bonus",
    description: "Click your ⚖ carry-weight badge (next to your name) to add a flat bonus to your carrying capacity — Belts of Giant Strength, feats, homebrew, etc.",
  },
  {
    date: "August 7, 2026",
    title: "Bag of Holding — items that don't count toward weight",
    description: "Any container (Items tab → Is a Container) can now be flagged \"Don't count contained items' weight\" so whatever's stashed inside stops counting toward your total carried weight. The container's own weight and its own capacity limit are unaffected.",
  },
  {
    date: "August 7, 2026",
    title: "Hide a container's contents",
    description: "Containers on the Items tab now have their own Show/Hide Items button, so a full backpack or bag doesn't have to take up space on screen when you don't need to see what's inside.",
  },
  {
    date: "August 7, 2026",
    title: "Modules and Font Size",
    description: "New Settings section to shrink the whole character sheet — fonts, padding, cards, everything — to 100%, 75%, or 50%, so more fits on screen at once.",
  },
  {
    date: "August 7, 2026",
    title: "Separate color per class",
    description: "Settings → Feature Styling → Class Features now has a \"Separate color per class\" checkbox — pick a different accent color for each class on a multiclass (or single-class) sheet instead of one shared color.",
  },
  {
    date: "July 20, 2026",
    title: "Feature Stylings",
    description: "Settings now has a Feature Stylings section — pick None, Outline, or an Animated Background (with its own color) for Racial Traits, Class Features, Feats, Invocations, Spells, Martial, and Familiars. Applies everywhere that category shows up on the sheet, not just when favorited.",
  },
  {
    date: "July 20, 2026",
    title: "Sliders require holding the thumb",
    description: "Clicking anywhere on a slider's track no longer jumps the value — you have to grab and drag the dot itself, which now has a larger touch target.",
  },
  {
    date: "July 20, 2026",
    title: "Max HP Modifier sign toggle",
    description: "Replaced the free-typed +/- number with a −/+ button next to the amount, since some mobile keyboards don't offer a minus-sign key on a numeric field.",
  },
  {
    date: "July 20, 2026",
    title: "DM roster stays current",
    description: "The DM's party roster now polls every 20 seconds as a backup to its live updates, so it catches up on its own if a realtime update ever gets missed.",
  },
  {
    date: "July 17, 2026",
    title: "Familiars now require opt-in",
    description: "Monsters need \"Available as a Familiar\" checked (Edit Stat Block) before they show up in a character's Add Familiar picker.",
  },
  {
    date: "July 17, 2026",
    title: "Magic Item styling on the Martial tab",
    description: "The ✨ badge and card treatment for items flagged Magic Item now show on the Martial tab too, matching the Items tab.",
  },
  {
    date: "July 17, 2026",
    title: "Weapon fields unified between Items and Martial",
    description: "Attack Stat, Magic Bonus, To Hit, Proficient, and Properties are now available and kept in sync whichever tab a weapon is edited from. The old \"+ Equipment\" button is now \"+ Martial Tab\".",
  },
  {
    date: "July 17, 2026",
    title: "Fixed squished rows in scrollable item lists",
    description: "Expanding an item near the bottom of the Equipped, Carried Items, or Martial lists no longer compresses other rows.",
  },
  {
    date: "July 17, 2026",
    title: "Custom creation dates on objects",
    description: "Right-click any character, note, campaign, monster, or folder → View Details to set or see a custom creation date.",
  },
  {
    date: "July 17, 2026",
    title: "Stealth disadvantage on armor",
    description: "Armor can be flagged to impose disadvantage on Stealth checks — it shows automatically next to the character's name while equipped.",
  },
]
