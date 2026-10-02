import type { CategoryId, WordId } from '@/entities/word'
import type { WordText } from '../../types'

export const categories: Record<CategoryId, string> = {
  muscle: 'Muscle signals',
  pain: 'Pain types',
  cycle: 'Cycle & hormones',
  energy: 'Energy & fuel',
}

export const words: Record<WordId, WordText> = {
  // Muscle signals
  strong: {
    word: 'strong',
    tagline: 'Notice how ready you feel',
    metaphor: 'Your body has power to give.',
    description:
      'A strong feeling can mean your muscles feel powerful, capable and ready to put in work.',
    feelsLike:
      'Your legs before a sprint when they feel solid, powerful and ready to drive you forward.',
    recommendation:
      'Your body is ready. Warm up well and enjoy the session. Remember this feeling for comparison on harder days.',
  },
  light: {
    word: 'light',
    tagline: 'Notice how fluid your movements feel',
    metaphor: 'Like gravity has lost its grip.',
    description:
      'Your body feels agile, fluid and free to move. Without tension, as if gravity has lost its grip.',
    feelsLike:
      'Bouncing on your toes and feeling your body move with ease: fresh, fluid and springy.',
    recommendation:
      "Great sign: you're well recovered. A good day for speed, skill work, or anything that needs freshness.",
  },
  sore: {
    word: 'sore',
    tagline: 'Notice how sensitive it feels',
    metaphor: 'The day-after receipt.',
    description:
      "The bill your muscles send 24–48 hours after new or harder work. A deep, ongoing and hard-to-pinpoint sensation that feels like a constant, widespread discomfort. It often affects more than one part of the body. Spread across a whole muscle, usually both sides, worse on the first move, better once you're warm.",
    feelsLike: 'More sensitive and tender than usual when you touch it, move it or use it.',
    recommendation:
      "Normal after hard or new work. Gentle movement, stretching, and foam rolling help. If it's one-sided or lasts more than 3 days, tell your coach/healthcare provider/parent/carer.",
  },
  achy: {
    word: 'achy',
    tagline: 'Notice how deep it feels',
    metaphor: "A radio hum you can't turn off.",
    description:
      'A deep, heavy-ish feeling spread through the muscles rather than one specific spot. Dull and vague without clear edges. Often it concerns several body parts at once.',
    feelsLike:
      'A dull and deep feeling that lingers. The body part is complaining and wants you to know.',
    recommendation:
      'Your muscles are processing a lot. Stretch, hydrate, fuel well, and get some good sleep. If it keeps coming back, check your recovery with your coach.',
  },
  tight: {
    word: 'tight',
    tagline: 'Notice what happens when you move it',
    metaphor: 'Like a muscle is being pulled shorter.',
    description:
      "A tight feeling can make a body part feel tense, restricted, or as though it doesn't have its usual range of motion and freedom to move.",
    feelsLike:
      "Something tense that is limiting your movement and holding you back. Trying to stretch a rubber band that doesn't want to stretch any further.",
    recommendation:
      'Stretch and warm up a little longer today. If tightness is always in the same place, mention it to your coach or physio.',
  },
  stiff: {
    word: 'stiff',
    tagline: 'Give it time to loosen',
    metaphor: 'A stuck zip.',
    description:
      'A stiff body part can feel harder to move or to extend all the way than usual. It may worsen in the first minutes of the morning or after sitting still, and loosen as you gently move, warm up, or change position.',
    feelsLike:
      'A block that opens up with gentle movement. Your legs when you first get out of bed after sleeping in one position for a long time.',
    recommendation:
      'Normal, especially in the morning or after sitting still. It usually loosens with gentle movement and warming up.',
  },
  unstable: {
    word: 'unstable',
    tagline: 'Avoid pushing through it',
    metaphor: 'A wobbly table leg.',
    description:
      "A body part feels wobbly, shaky or less secure than usual. The muscles that hold it steady aren't keeping up with your asks, usually when you're tired, landing or changing direction. It might give way and be unreliable under load.",
    feelsLike:
      "You can't fully trust it to support you or move the way you expect. Like stepping onto a chair with one loose leg.",
    recommendation:
      "Your body can't fully trust this area right now. Don't push through it. Reduce load and tell your coach. If it gives way, seek assessment.",
  },
  // Pain types
  crampy: {
    word: 'crampy',
    tagline: 'Notice the rhythm',
    metaphor: 'Like something inside is tightening and relaxing.',
    description:
      'A crampy feeling often comes in waves, with a squeezing or tightening sensation that builds, holds for a couple of seconds, eases, and may come back again.',
    feelsLike:
      'Making a fist, holding it tight for a moment, then letting it open, except the squeezing is happening inside your body.',
    recommendation:
      "A squeezing that comes in waves. If it's in your belly and around your period, gentle movement and warmth can help. If it's in a muscle (like your calf or foot), stop, stretch it gently, and drink water. Muscle cramps often mean you're dehydrated or your muscles are fatigued. If cramps regularly stop you from training, talk to a doctor/coach/carer.",
  },
  gripping: {
    word: 'gripping',
    tagline: 'Notice how long it holds',
    metaphor: 'A hand holding on.',
    description:
      'A constant clench in one precise spot. It forces you to hold a certain position and you find yourself guarding it. Often a muscle protecting something.',
    feelsLike:
      'A strong squeezing feeling that can feel as though something inside your body is grabbing or clenching.',
    recommendation:
      "Something is clenching to protect an area. Don't force through it. Rest, apply gentle heat, and if it doesn't ease in a day or two, seek support.",
  },
  sharp: {
    word: 'sharp',
    tagline: 'Can you point exactly where you feel it?',
    metaphor: 'A paper cut.',
    description:
      "Sudden, precise, and you can point to exactly where it is with one finger. It can arrive at a specific moment in a movement. A sharp feeling makes you change what you're doing.",
    feelsLike: 'A quick, pointed feeling that makes you immediately notice that one spot.',
    recommendation:
      "Stop the movement that caused it. If you can point to the exact spot with one finger, that's important information. Don't test it again; flag it to your coach and seek support if it returns.",
  },
  stabbing: {
    word: 'stabbing',
    tagline: 'Pause and pay attention',
    metaphor: 'A sudden needle-like jab.',
    description:
      'A stabbing sensation feels pointed and piercing, as if something briefly poked or jabbed you from inside. If sharp says "not like that", stabbing says "not at all."',
    feelsLike:
      'A quick needle-like jab that makes you stop and notice exactly where it happened.',
    recommendation:
      "This is your body's strongest stop signal. Pause all activity on that area. Tell your coach and a trusted adult. Seek physio or medical assessment — do not try to push through.",
  },
  burning: {
    word: 'burning',
    tagline: 'Notice if it fades',
    metaphor: 'A match, not a fire.',
    description:
      "A hot, stinging feeling inside a muscle that can build during hard exercise. When it's from working hard, it usually eases soon after you slow down or stop.",
    feelsLike:
      "Your thighs on a long flight of stairs. It builds while you're climbing and eases after you reach the top.",
    recommendation:
      "Common sensation during hard effort, which should fade within minutes of stopping. If it doesn't fade, or it happens at low intensity or at rest, stop and flag it to your coach.",
  },
  tingling: {
    word: 'tingling',
    tagline: 'Observe the little sparks',
    metaphor: 'Fizzy drink under the skin.',
    description:
      'Often a nerve being squeezed or irritated. Some girls may experience tingling in their hands or feet before their period.',
    feelsLike:
      "Your foot after you've sat on it too long. A fizzy sensation that travels along a line.",
    recommendation:
      'Often a nerve being squeezed. Change position, loosen anything tight (shoes, straps). If it keeps happening in the same spot, mention it to your staff or parents.',
  },
  numb: {
    word: 'numb',
    tagline: "Notice what's changed",
    metaphor: 'The volume turned to zero.',
    description:
      'Numbness means you feel less sensation than usual, or almost none. Touch, pressure or temperature might feel muted or distant.',
    feelsLike:
      'Like a body part has gone quiet. You can tell you are touching it, but only faintly, such as the skin behind a glove or a layer of clothing.',
    recommendation:
      "If brief and from holding position for long time, move gently until it goes. If it happens during exercise, is spreading, or doesn't go away, then stop and seek assessment. Numbness during sport is always worth checking.",
  },
  // Cycle & hormones
  bloated: {
    word: 'bloated',
    tagline: "Notice if it's from the inside",
    metaphor: 'A balloon being slowly inflated.',
    description:
      'A feeling of fullness, pressure or tightness from inside. Your body part may feel tighter or swollen without anything visibly changing.',
    feelsLike:
      'Like your stomach has puffed up from the inside. A stretched, pressured feeling that sitting down can make worse.',
    recommendation:
      'Very common around your period. Make sure to drink a lot of water (it helps!) and wear comfortable clothing.',
  },
  tender: {
    word: 'tender',
    tagline: 'Notice if touch makes it worse',
    metaphor: 'A bruise you cannot see.',
    description:
      "A part of your body feels more sensitive or painful than usual when touched, pressed or bumped, even though you didn't injure it.",
    feelsLike: "Your body's sensitivity dial has been turned up.",
    recommendation:
      'Sensitivity without injury can be common before your period. Wear supportive clothing.',
  },
  nauseous: {
    word: 'nauseous',
    tagline: 'Notice if it comes in waves',
    metaphor: 'A boat rocking.',
    description: 'A queasy, unsettled feeling, that can come and go in waves.',
    feelsLike:
      'That wavy, uncomfortable feeling on a long car ride, where everything feels to move a bit too much.',
    recommendation:
      'Sip water slowly and try to eat something small and bland. Try not to train on an empty stomach. If it happens a lot with dizziness or shaking, seek support.',
  },
  swollen: {
    word: 'swollen',
    tagline: 'Notice the change',
    metaphor: 'A water balloon under the skin.',
    description:
      "Like there's extra space being taken up. A swollen area can feel fuller, puffier, tighter or heavier than usual. Sometimes you can see the difference; sometimes you mainly feel it.",
    feelsLike: "A finger after you've worn a ring that's suddenly become too tight.",
    recommendation:
      'If both sides and around your period: normal fluid retention. If one side and after an injury: ice, elevate the body part, and seek support.',
  },
  hot: {
    word: 'hot',
    tagline: 'Warm from the inside or the outside?',
    metaphor: "The back of a laptop that's been running long.",
    description:
      'A warm sensation can be superficial, like skin that feels warmer than usual to the touch, or deeper inside the body. Hot pain is a deep burning sensation that spreads through the tissues like hot liquid.',
    feelsLike: 'A dull, heavy fire that seems to melt your muscles from the inside.',
    recommendation:
      "Drink more water to stay hydrated and take breaks in shade (if you're under the sun). If you feel very hot with dizziness, confusion, or you stopped sweating, seek help immediately.",
  },
  // Energy & fuel
  heavy: {
    word: 'heavy',
    tagline: 'Notice how much effort everything takes',
    metaphor: 'Gravity has been turned up.',
    description:
      'Your whole body feels weighed down, sluggish and slow to respond. Every movement costs more effort than usual, as though gravity has been turned up.',
    feelsLike:
      "Moving through waist-deep water. Your legs, arms and even your head feel like they're made of something heavier than usual.",
    recommendation:
      'Everything costs more effort today. Your body may need additional fuel, sleep, or recovery. Try to take it easier and notice what happens. If this sensation occurs often, tell your coach about it.',
  },
  dizzy: {
    word: 'dizzy',
    tagline: 'Pause. Let the world catch up',
    metaphor: 'A spinning top slowing down.',
    description:
      'The room tilts, your balance wavers, or everything feels slightly off-centre. It can come unexpectedly, in a flash.',
    feelsLike:
      'Standing up too fast after lying down and the floor seeming to tilt for a second or two.',
    recommendation:
      'Stop and sit down. Drink water and eat something. Wait to return to training until it fully passes. If it keeps happening, talk to a healthcare provider.',
  },
  headachy: {
    word: 'headachy',
    tagline: 'Notice where the pressure sits',
    metaphor: 'A too-tight headband.',
    description:
      'Pressure, pounding or aching around your forehead, temples, or the back of your head.',
    feelsLike:
      'A band of pressure squeezing around your head, or a dull thud behind your eyes that gets louder when you bend over.',
    recommendation:
      'Make sure to drink water, get some rest in a quiet spot and stay away from screens if possible. It can also be common around your period.',
  },
  foggy: {
    word: 'foggy',
    tagline: 'Notice if your thinking feels slower',
    metaphor: 'A steamed-up window.',
    description:
      "Your brain feels cloudy, slow or disconnected. Decisions that are normally instant take extra time, you miss cues you'd usually catch, or you find yourself staring into space.",
    feelsLike:
      'Reading the same sentence three times and still not taking it in. Knowing the answer but not being able to reach it.',
    recommendation:
      'Your brain may need additional fuel, water or sleep. If it happens a lot, tell your support system about it.',
  },
  shaky: {
    word: 'shaky',
    tagline: 'Notice if your body needs fuel',
    metaphor: 'A phone on 3% battery.',
    description:
      "An internal trembling or wobbliness from your system telling you it's running low.",
    feelsLike: 'The trembly, hollow feeling that makes you feel weak and unstable',
    recommendation:
      'Your body may need additional energy to keep you. Remember to fuel before and after training, especially if this sensation keeps showing up.',
  },
}
