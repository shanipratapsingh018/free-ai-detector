/** Calibration passages. "ai" entries imitate common model output; "human" entries are informal or idiosyncratic prose. */
export const ai = [
`In today's fast-paced digital landscape, artificial intelligence plays a crucial role in transforming how businesses operate. By leveraging advanced algorithms, organizations can streamline workflows, enhance productivity, and unlock new opportunities for growth. Furthermore, AI-driven tools provide valuable insights that empower leaders to make informed decisions.

One key benefit of artificial intelligence is its ability to automate repetitive tasks. This not only reduces operational costs but also allows employees to focus on more meaningful work. Additionally, machine learning models can analyze vast amounts of data, identifying patterns that would otherwise go unnoticed.

However, it is important to note that adopting AI comes with challenges. Organizations must navigate the complexities of data privacy, ethical considerations, and workforce adaptation. By fostering a culture of continuous learning, companies can ensure that their teams remain resilient and adaptable.

In conclusion, artificial intelligence serves as a transformative force across industries. With a thoughtful and comprehensive approach, businesses can harness its potential while addressing its risks.`,
`Regular exercise offers a wide range of benefits for both physical and mental health. It strengthens the cardiovascular system, improves muscle tone, and supports healthy weight management. Moreover, physical activity has been shown to reduce stress, enhance mood, and promote better sleep.

Another important aspect of exercise is its role in preventing chronic diseases. Individuals who maintain an active lifestyle are less likely to develop conditions such as diabetes, heart disease, and hypertension. Additionally, exercise supports cognitive function, helping people stay focused and productive throughout the day.

Ultimately, incorporating regular movement into daily routines is essential for overall well-being. Whether through walking, cycling, or strength training, consistent activity provides lasting benefits that contribute to a healthier and more fulfilling life.`,
`Climate change is one of the most pressing challenges facing humanity today. Rising global temperatures are leading to more frequent extreme weather events, melting ice caps, and rising sea levels. These changes pose significant risks to ecosystems, economies, and communities around the world.

Addressing climate change requires a comprehensive and coordinated approach. Governments must implement robust policies that reduce greenhouse gas emissions, promote renewable energy, and support sustainable development. Furthermore, businesses play a pivotal role by adopting environmentally responsible practices and investing in innovative technologies.

Individuals also have an important part to play. By making thoughtful choices about energy use, transportation, and consumption, people can contribute to a more sustainable future. Together, these efforts can help mitigate the impacts of climate change and ensure a healthier planet for future generations.`,
`Effective communication is a cornerstone of successful teamwork. It enables team members to share ideas, align on goals, and resolve conflicts constructively. When communication is clear and consistent, teams are better equipped to collaborate, innovate, and deliver high-quality results.

To foster effective communication, organizations should encourage open dialogue, provide regular feedback, and utilize appropriate tools. Additionally, active listening plays a vital role in ensuring that every voice is heard and valued. By creating an inclusive environment, leaders can empower their teams to contribute meaningfully.

Overall, investing in communication skills yields significant benefits, including improved morale, stronger relationships, and enhanced productivity.`
];
export const human = [
`So the washing machine died again. Third time this year! I rang the repair guy (the one with the van that smells of chips) and he just laughed. "Buy a new one," he said. Easy for him.

Anyway, I didn't. I watched a video, took the back off, and found a sock wedged in the pump. One sock. Blue, with a hole in the toe. I've no idea whose it is.

It works now, sort of. It makes a noise like a cat being sat on, but the clothes come out wet and clean, which is all I ever asked of it. My sister says I'm an idiot and it'll flood the kitchen. She's probably right. We'll see.`,
`We ran the experiment twice because the first batch was ruined, and honestly I'm still not sure the second one is clean. The pH drifted overnight. Rahul thinks the buffer was old; I think somebody left the lid off. Either way the readings at 6 a.m. were garbage.

What we did get: three decent curves out of twelve wells. Not great. The peak sits at 412 nm, which is close to what Chen reported in 2019, but ours is broader and I can't explain that yet. Could be aggregation? Could be the plate reader, which has been acting up since March.

I'll redo it on Thursday with fresh buffer. If it drifts again, it's not the buffer.`,
`My father never talked about the war. He talked about cricket, about the price of onions, about how the neighbour's mango tree leaned over our wall and whose mangoes they really were. But not the war.

Once, when I was nine or ten, I found a tin box under his bed. Inside: a medal, two photographs, a letter in a language I couldn't read. I put it back. I didn't ask. Children know, somehow, which questions are doors and which are walls.

He died in 2004. The box went to my brother, who lost it in a house move — or says he did. I still think about that letter. Who wrote it? What did it say? Nobody alive can tell me now, and that's a strange thing to carry around.`,
`Quick update on the server move. It went badly, then fine. We started at 11 pm, and by midnight the database copy had failed twice (disk full, my fault, I forgot the old logs). Priya cleared 40 GB and we tried again. That one worked.

DNS took ages. Why does DNS always take ages? At 2:30 I was refreshing the page like an idiot and it still showed the old box. Went to make tea, came back, done.

Things still broken: the cron job for backups, and email from the contact form. I'll fix both tomorrow. Don't touch the old machine yet — I want it around for a week in case we've missed something.`
];
import { samples } from '../public/samples.js';
ai.push(samples.ai); human.push(samples.human);
