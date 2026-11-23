# Anatomy Atlas Content Style Guide

## Audience

Write for curious adults with no medical or biology background. Plain, accurate English comes first; technical or Latin terms come second.

## Fields & Tone

- **Overview** (`<= 400` characters, 1–3 sentences): what the structure is and where it sits in everyday terms.
- **Function** (`<= 600` characters, 1 short paragraph): what it does and why it matters to movement, support, or bodily function.
- **Unavoidable technical terms:** briefly explain any specialist term inline in the same sentence (for example, _"the lateral epicondyle, the bony bump on the outer side of the lower humerus"_).
- **Plain text only:** do not use HTML tags (`<b>`, `<p>`), Markdown formatting (`**bold**`, `[links](url)`), or bullet symbols inside JSON text fields.
- **No medical advice:** describe normal anatomy and function strictly for learning and curiosity; do not include diagnoses, symptoms, or clinical recommendations.
- **Latin (`names.latin`):** the standard _Terminologia Anatomica_ (TA) Latin name when one exists.
- **Synonyms (`names.synonyms`):** common everyday or search names people look for (for example, `"thigh bone"` for `femur`, or `"collarbone"` for `clavicle`). Omit side prefixes (`left`/`right`) from names; laterality is derived automatically from the MeshId.

## Sources & Licensing

Every factual claim (bone type, articulations, muscle origin, insertion, innervation, blood supply, action, and key facts) must be verified against a source listed in that entry's `sources[]`.

- **Adaptable in plain language (never pasted verbatim):**
  - Wikipedia — `license: "CC-BY-SA-4.0"`
  - OpenStax _Anatomy and Physiology 2e_ — `license: "CC-BY-4.0"`
- **Factual verification only (must be written independently):**
  - Standard textbooks or anatomical references — `license: "facts-only"`
- Include an exact section-anchor URL in `sources[].url` whenever the reference provides one, and include at least one source other than Z-Anatomy on every featured entry.

## Worked Examples

These examples follow the `StructureFileSchema` (`content/en/structures/<system>.json`) and pass `npm run check:content`.

### Bone (`structures/skeletal.json`)

```json
{
  "id": "femur",
  "overview": "The thigh bone is the longest, heaviest, and strongest bone in the human body, running down each upper leg from the hip socket to the knee.",
  "function": "It transfers the full weight of your upper body into the lower leg when standing, walking, and running, while acting as a rigid lever for the large thigh and hip muscles.",
  "details": {
    "kind": "bone",
    "boneType": "long",
    "articulatesWith": ["hip-bone", "patella", "tibia"]
  },
  "sources": [
    {
      "title": "OpenStax Anatomy and Physiology 2e — Bones of the Lower Limb (Femur)",
      "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
      "license": "CC-BY-4.0"
    }
  ]
}
```

### Muscle (`structures/muscular.json`)

```json
{
  "id": "long-head-of-biceps-brachii",
  "overview": "The long head of the biceps brachii forms the outer half of the familiar two-headed muscle along the front of the upper arm.",
  "function": "It bends the arm at the elbow, twists the forearm so the palm faces upward (supination), and helps steady the top of the upper arm bone inside the shoulder joint.",
  "details": {
    "kind": "muscle",
    "origin": "Upper rim of the shoulder socket (supraglenoid tubercle of the scapula)",
    "insertion": "Upper forearm bone near the elbow (radial tuberosity) and forearm fascia",
    "innervation": "Musculocutaneous nerve",
    "bloodSupply": "Brachial artery branches",
    "action": "Flexes the elbow, turns the palm upward (supination), and assists shoulder flexion"
  },
  "sources": [
    {
      "title": "OpenStax Anatomy and Physiology 2e — Appendicular Muscles of the Pectoral Girdle and Upper Limbs",
      "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs",
      "license": "CC-BY-4.0"
    }
  ]
}
```
