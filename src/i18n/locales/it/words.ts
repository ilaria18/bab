import type { CategoryId, WordId } from '@/entities/word'
import type { WordText } from '../../types'

// Traduzione italiana, rivolta a te con il "tu". L'app è pensata solo per ragazze, quindi
// tutto ciò che si accorda con chi legge sta al femminile ("ti sei scaldata"). Le parole-sensazione
// stanno al femminile singolare (o sono nomi), perché compaiono anche da sole, ad esempio in
// "Sensazione: …"; "la zona" è il riferimento per i pronomi ("quando la muovi").

export const categories: Record<CategoryId, string> = {
  muscle: 'Segnali muscolari',
  pain: 'Tipi di dolore',
  cycle: 'Ciclo e ormoni',
  energy: 'Energia e carburante',
}

export const words: Record<WordId, WordText> = {
  // Segnali muscolari
  strong: {
    word: 'forte',
    tagline: 'Nota quanto ti senti pronta',
    metaphor: 'Il tuo corpo ha forza da dare.',
    description:
      'Senti i muscoli potenti, solidi, capaci di spingere.',
    feelsLike:
      'Le tue gambe prima di uno sprint, quando le senti solide, potenti e pronte a spingerti in avanti.',
    recommendation:
      'Il tuo corpo è pronto. Scaldati bene e goditi la sessione. Ricorda questa sensazione per confrontarla nei giorni più difficili.',
  },
  light: {
    word: 'leggero',
    tagline: 'Nota quanto sono fluidi i movimenti',
    metaphor: 'La gravità che non ha più presa.',
    description:
      'Il corpo si sente agile, fluido e libero nei movimenti. Senza tensioni, come se la gravità non avesse più presa.',
    feelsLike:
      'Saltellare sulla punta dei piedi e sentire che il corpo si muove facilmente: fresco, fluido e scattante.',
    recommendation:
      'Ottimo segno: hai recuperato bene. Una buona giornata per darci dentro.',
  },
  sore: {
    word: 'indolenzito',
    tagline: 'Controlla se è dolente al tatto',
    metaphor: 'Il conto che arriva il giorno dopo.',
    description:
      'Il conto che il corpo ti presenta 24–48 ore dopo un allenamento nuovo o più intenso del solito. Più evidente con i primi movimenti, tende a diminuire una volta che ti sei scaldata.',
    feelsLike:
      'Una zona che senti più sensibile e dolente del solito quando la tocchi, la muovi o la usi.',
    recommendation:
      'Normale dopo un allenamento intenso o nuovo. Movimento leggero, stretching e foam rolling aiutano. Se è unilaterale o dura più di 3 giorni, parlane con il tuo allenatore/medico/genitore o tutore.',
  },
  achy: {
    word: 'dolore sordo',
    tagline: 'Nota quanto è profondo e diffuso',
    metaphor: 'Un ronzio che non riesci a spegnere.',
    description:
      'Una sensazione profonda, continua e poco definita, che si presenta come un fastidio costante e diffuso. Spesso coinvolge più parti del corpo.',
    feelsLike:
      'Se quella parte del corpo si stesse lamentando e volesse assicurarsi di fartelo sapere. Una sensazione tollerabile ma spossante.',
    recommendation:
      'I tuoi muscoli stanno facendo gli straordinari.. Fai stretching, idratati, nutriti bene e dormi a sufficienza. Se continua a ripresentarsi, parlane con il tuo allenatore e controllate insieme come stai recuperando.',
  },
  tight: {
    word: 'teso',
    tagline: 'Nota cosa succede quando lo muovi',
    metaphor: 'Come se un muscolo si fosse accorciate',
    description:
      'Una sensazione di tensione può far sentire una parte del corpo contratta, limitata o meno libera di muoversi come al solito.',
    feelsLike:
      'Qualcosa che ti trattiene e che limita alcuni movimenti. Come provare a tirare un elastico che non vuole più allungarsi.',
    recommendation:
      'Oggi fai stretching e riscaldati un po\' più a lungo. Se la tensione è sempre nello stesso punto, parlane con il tuo allenatore o fisioterapista.',
  },
  stiff: {
    word: 'rigido',
    tagline: 'Dagli il tempo di sciogliersi',
    metaphor: 'Come una cerniera inceppata.',
    description:
      'Più difficile da muovere o da distendere completamente del solito. Può farsi sentire di più più al mattino o dopo essere rimasta ferma a lungo, e diminuire quando inizi a muoverti delicatamente, ti riscaldi o cambi posizione.',
    feelsLike:
      'Un blocco che più lo muovi, più si scioglie. Come le gambe quando ti alzi dal letto dopo aver dormito a lungo nella stessa posizione.',
    recommendation:
      'Normale, specialmente al mattino o dopo essere rimasta a lungo nella stessa posizione. Di solito si scioglie con un po’ di movimento leggero e dopo il riscaldamento.',
  },
  unstable: {
    word: 'instabile',
    tagline: 'Fai attenzione',
    metaphor: 'La gamba traballante di un tavolo.',
    description:
      'Una parte del corpo può sentirsi instabile, tremolante o meno sicura del solito. I muscoli che la tengono stabile possono non riuscire a stare al passo con quello che stai chiedendo loro, per esempio quando sei stanca, atterri o cambi direzione.',
    feelsLike:
      'Se possa cedere o non essere affidabile sotto carico. Come salire su una sedia con una gamba lenta. Non è rotta, ma non ti fidi.',
    recommendation:
      'Il tuo corpo al momento non si fida pienamente di questa parte. Non sforzarla. Riduci il carico e parlane con il tuo allenatore. Se cede, richiedi una valutazione medica.',
  },
  // Tipi di dolore
  crampy: {
    word: 'crampo',
    tagline: 'Nota il ritmo',
    metaphor: 'Lo schermo che s\'impalla per qualche secondo',
    description:
      'Una sensazione di crampo di solito arriva a ondate: qualcosa si stringe o si contrae, aumenta, rimane così per un paio di secondi, poi si allenta e può tornare di nuovo.',
    feelsLike:
      'Stringi forte il pugno, lo tieni stretto per un momento e poi lo riapri.',
    recommendation:
      'Se è nella pancia e il ciclo è dietro l\'angolo, il movimento leggero e il calore possono aiutare. Se è in un muscolo (come il polpaccio o il piede), fermati, allungalo delicatamente e bevi acqua. I crampi muscolari spesso indicano disidratazione o affaticamento muscolare. Se i crampi ti impediscono regolarmente di allenarti, parlane con un medico/allenatore/tutore.',
  },
  gripping: {
    word: 'a morsa',
    tagline: 'Notane la durata',
    metaphor: 'Come una mano che non molla la presa.',
    description:
      'Una sensazione di forte contrazione, concentrata in un punto preciso. Può costringerti a tenere una certa posizione. A volte è il modo in cui un muscolo cerca di proteggere un\'altra parte del corpo.',
    feelsLike:
      'Una stretta forte e salda, come se qualcosa ti stesse afferrando o stringendo da dentro.',
    recommendation:
      'Qualcosa si sta contraendo per proteggere un\'area. Non sforzarla. Prova a recuperare e ad applicare del calore, come una borsa dell\'acqua calda. Se non si allevia in uno o due giorni, chiedi supporto.',
  },
  sharp: {
    word: 'pungente',
    tagline: 'Riesci a indicare esattamente dove lo senti?',
    metaphor: 'Un taglio con la carta, non un livido',
    description:
      'È una sensazione rapida e improvvisa, che può comparire in un momento preciso di un movimento. Riesci ad indicare con un dito il punto esatto in cui la percepisci e può farti cambiare il modo in cui ti stai muovendo.',
    feelsLike:
      'In modo rapido, puntiforme, e inaspettato. Come un piccolo ago che riesci a localizzare immediatamente',
    recommendation:
      'Interrompi il movimento che l\'ha causata. Se riesci a indicare il punto esatto con un dito, è un\'informazione importante. Segnalalo al tuo allenatore e chiedi supporto se ritorna.',
  },
  stabbing: {
    word: 'trafittivo',
    tagline: 'Fermati e presta attenzione',
    metaphor: 'Come una fitta improvvisa.',
    description:
      'È una fitta profonda, intensa e penetrante, come se venissi trafitta da un oggetto appuntito.',
    feelsLike:
      'Un dolore che ti lascia "senza fiato" o che ti costringe ad interrompere ciò che stavi facendo.',
    recommendation:
      'Questo è il segnale di stop più forte del tuo corpo. Interrompi ogni attività che coinvolge quell\'area. Parlane con il tuo allenatore o con un adulto di fiducia.',
  },
  burning: {
    word: 'bruciante',
    tagline: 'Nota se si attenua',
    metaphor: 'Un fiammifero, non un incendio.',
    description:
      'Una sensazione calda e pungente, come un bruciore, che può aumentare durante uno sforzo intenso. Quando è legata al lavoro muscolare, di solito passa poco dopo che rallenti o ti fermi.',
    feelsLike:
      'Le cosce dopo una lunga rampa di scale. Il bruciore aumenta mentre sali e si attenua poco dopo che hai raggiunto la cima.',
    recommendation:
      'Sensazione comune durante uno sforzo intenso, che dovrebbe attenuarsi entro pochi minuti dall\'aver smesso. Se non si attenua, o si presenta a bassa intensità o a riposo, segnalalo al tuo allenatore.',
  },
  tingling: {
    word: 'formicolante',
    tagline: 'Facci caso con attenzione',
    metaphor: 'Tante formichine che ballano.',
    description:
      'Un pizzichio spesso dovuto a un nervo schiacciato o irritato. Ad alcune ragazze capita di sentire formicolio a mani o piedi prima del ciclo.',
    feelsLike:
      'Il piede dopo che ci sei stata seduta sopra troppo. Una sensazione frizzante che corre lungo una linea.',
    recommendation:
      'Spesso può essere dovuta a un nervo schiacciato. Prova a cambiare posizione e allenta tutto ciò che è stretto (scarpe, cinghie). Se continua a ripresentarsi nello stesso punto, parlane con lo staff o con i tuoi genitori.',
  },
  numb: {
    word: 'intorpidito',
    tagline: 'Nota cosa è cambiato',
    metaphor: 'Come se il volume fosse a zero.',
    description:
      'Quando una parte del corpo è intorpidita, senti meno del solito o quasi niente. Il tatto, la pressione o la temperatura possono sembrarti attenuati o lontani.',
    feelsLike:
      'Se una parte del corpo fosse diventata silenziosa. Sai che la stai toccando, ma la senti solo debolmente, quasi come se indossassi un guanto.',
    recommendation:
      'Se è breve e dovuto al mantenere una posizione a lungo, muoviti delicatamente finché non passa. Se accade durante l\'esercizio, si diffonde o non passa, fermati e richiedi una valutazione. L\'intorpidimento durante lo sport vale sempre la pena di essere controllato.',
  },
  // Ciclo e ormoni
  bloated: {
    word: 'gonfiore addominale',
    tagline: 'Nota se viene da dentro',
    metaphor: 'Un palloncino che si gonfia lentamente.',
    description:
      'Una sensazione di pienezza, pressione o tensione dall\'interno. Quella parte del corpo può sembrare più tesa o gonfia senza che nulla cambi visibilmente.',
    feelsLike:
      'Come se lo stomaco si fosse gonfiato dall\'interno.',
    recommendation:
      'Può essere molto comune vicino al ciclo. Assicurati di bere molta acqua (aiuta!) e indossa abiti comodi.',
  },
  tender: {
    word: 'sensibile',
    tagline: 'Nota se il tocco lo peggiora',
    metaphor: 'Un livido che non si vede.',
    description:
      'Una parte del corpo si sente più sensibile o dolorante del solito quando viene toccata, premuta o urtata, anche se non ti sei fatta male.',
    feelsLike:
      'Come se la manopola della sensibilità del tuo corpo fosse stata alzata.',
    recommendation:
      'La sensibilità non dovuta a lividi o infortuni può essere comune prima del ciclo. Indossa capi che offrano un buon sostegno.',
  },
  nauseous: {
    word: 'nausea',
    tagline: 'Nota se va e viene a ondate',
    metaphor: 'Una barca che dondola.',
    description:
      'Una sensazione di malessere e agitazione allo stomaco, che può andare e venire a ondate.',
    feelsLike:
      'Quella sensazione ondeggiante e sgradevole durante un lungo viaggio in macchina, dove tutto sembra muoversi un po\' troppo.',
    recommendation:
      'Bevi acqua a piccoli sorsi. Mangia qualcosa di leggero e semplice, e cerca di evitare di allenarti a stomaco vuoto. Se succede spesso insieme a vertigini o tremori, fallo presente.',
  },
  swollen: {
    word: 'gonfiore',
    tagline: 'Nota cosa è cambiato',
    metaphor: 'Come un palloncino d’acqua sotto la pelle.',
    description:
      'Una zona gonfia può sembrare più piena, più tonda, più tesa o più pesante del solito. A volte la differenza si vede; a volte si sente e basta.',
    feelsLike:
      'Un dito dopo aver tenuto un anello che all’improvviso è diventato troppo stretto.',
    recommendation:
      'Se riguarda entrambi i lati ed è vicino al ciclo: è normale ritenzione idrica. Se riguarda un solo lato e segue un infortunio: applica ghiaccio, solleva la parte del corpo e chiedi supporto.',
  },
  hot: {
    word: 'caldo',
    tagline: 'Il calore viene da dentro o da fuori?',
    metaphor: 'Come il retro di un computer che è rimasto acceso a lungo.',
    description:
      'Una sensazione di caldo può essere superficiale, come la pelle che al tatto è più calda del solito, oppure più in profondità nel corpo. Il dolore caldo è una sensazione di bruciore profondo che si espande nei tessuti come un liquido rovente.',
    feelsLike:
      'Un fuoco sordo e denso che sembra sciogliere i muscoli dall\'interno.',
    recommendation:
      'Bevi più acqua per rimanere idratata e fai delle pause all\'ombra (se sei sotto il sole). Se ti senti molto calda con vertigini, confusione, o hai smesso di sudare, chiedi aiuto immediatamente.',
  },
  // Energia e carburante
  heavy: {
    word: 'pesante',
    tagline: 'Nota quanto sforzo richiede ogni cosa',
    metaphor: 'La gravità è aumentata.',
    description:
      'Il corpo si sente appesantito, lento e poco reattivo. Ogni movimento ti costa più fatica del solito.',
    feelsLike:
      'Muoversi in mare con l\'acqua fino alla vita.',
    recommendation:
      'Il tuo corpo potrebbe aver bisogno di più energia, sonno o recupero. Cerca di prendertela con calma e osserva cosa succede. Se questa sensazione si presenta spesso, parlane con il tuo allenatore.',
  },
  dizzy: {
    word: 'stordito',
    tagline: 'Fermati. Lascia che il mondo ti raggiunga',
    metaphor: 'Una trottola che rallenta.',
    description:
      'La stanza si inclina, l\'equilibrio vacilla, o tutto sembra leggermente fuori asse. Può arrivare all\'improvviso, in un lampo.',
    feelsLike:
      'Ti alzi troppo velocemente dopo essere stata sdraiata e senti il pavimento inclinarsi per un secondo o due.',
    recommendation:
      'Fermati e siediti. Prova a bere dell\'acqua e mangiare qualcosina. Aspetta che passi completamente prima di tornare all\'allenamento. Se continua a succedere, parlane con un medico.',
  },
  headachy: {
    word: 'mal di testa',
    tagline: 'Nota dove si concentra la pressione',
    metaphor: 'Una fascia troppo stretta in testa.',
    description:
      'Pressione, pulsazioni o dolore intorno alla fronte, alle tempie o alla nuca.',
    feelsLike:
      'Una fascia che stringe intorno alla testa, o un tonfo sordo dietro gli occhi che diventa più forte quando ti pieghi in avanti.',
    recommendation:
      'Assicurati di bere acqua, riposa in un luogo tranquillo e, se possibile, stai lontana dagli schermi. Può anche essere comune vicino al ciclo.',
  },
  foggy: {
    word: 'offuscato',
    tagline: 'Nota se i pensieri sembrano più lenti',
    metaphor: 'Un finestrino appannato.',
    description:
      'Il cervello si sente annebbiato, lento o distaccato. Le decisioni che normalmente prendi all\'istante richiedono più tempo, ti sfuggono segnali che di solito noteresti, oppure ti ritrovi a fissare il vuoto.',
    feelsLike:
      'Leggere la stessa frase tre volte senza riuscire a capirla. Conoscere la risposta ma non riuscire a ricordarla.',
    recommendation:
      'Il tuo cervello potrebbe aver bisogno di più energia, acqua o sonno. Se ti capita spesso, parlane con le persone che ti supportano.',
  },
  shaky: {
    word: 'tremante',
    tagline: 'Nota se il tuo corpo ha bisogno di energia',
    metaphor: 'Un telefono al 3% di batteria.',
    description:
      'Un tremore interno o un senso di instabilità, il tuo corpo che ti dice che le energie stanno finendo.',
    feelsLike:
      'Quella sensazione tremolante e vuota che ti fa sentire debole e instabile',
    recommendation:
      'Il tuo corpo potrebbe aver bisogno di più energia. Ricorda di nutrirti prima e dopo l\'allenamento, soprattutto se questa sensazione continua a presentarsi.',
  },
}