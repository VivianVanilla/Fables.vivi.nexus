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
