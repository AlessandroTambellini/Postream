import { db_store_msg, count_msgs } from "./database.mjs";

const msgs = [
    "What are the differences between .gitignore and .gitkeep? Are they the same thing with a different name, or do they both serve a different function?\nI don't seem to be able to find much documentation on .gitkeep.",
    ".gitkeep isn't documented, because it's not a feature of Git.",
    "Giacomo Leopardi (Giacomo Taldegardo Francesco Salesio Saverio Pietro Leopardi; Recanati, 29 giugno 1798[1] - Napoli, 14 giugno 1837) è stato un poeta, filosofo, scrittore e filologo italiano.",
    "Read A Programmable Web: An Unfinished Work, by Aaron Swartz. It makes a bunch of interesting points related to: openess of data, API design, structure of URLs, Digest access authentication built-in HTTP, stateless web, robots & crawlers.",
    "It is sometimes difficultto decide if a particular site is worth your time. This is why it's important for authors to include endorsements from other experts in the field.",
    "A msg.",
    "A msg.\n\nA paragraph.\n\nAn ending.\n",
    "1 2 3. (3 + 2)* 3 = 15",
    "Wikipedia is hosted by the Wikimedia Foundation, a non-profit organization that also hosts a range of other projects. You can support our work with a donation.",
    "Gemini protocol, browser, Voronoi:\nMaking UI in Jai"
];

async function seed_db() {
    const num_of_msgs = count_msgs();
    
    // Only seed if database is empty
    if (num_of_msgs === 0) {
        console.log('Seeding database with sample data...');
        for (const msg of msgs) {
            await db_store_msg(msg);
        }
        console.log('Database seeded successfully.');
    }
}

seed_db()
