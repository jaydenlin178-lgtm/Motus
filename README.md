# Motus

Motus turns a phone into a movement lab for Parkinson's disease. It does three jobs. For adults without a diagnosis, it screens for the early signs of Parkinson's with a short questionnaire and five camera, microphone, and touchscreen tests, then turns the results into a clear next step and a report to bring to a doctor. For people already diagnosed, it runs a one-minute check several times a day and shows how movement rises and falls between levodopa doses, which is the pattern a neurologist needs to see to fix wearing off. It also coaches six exercises drawn from Parkinson's therapy, and each one measures the person first and sets the practice target from that measurement.

Everything runs on the phone. No video, audio, or answers leave the device, and there are no accounts.

Motus was built for the 2026 Congressional App Challenge.

## Why it matters

Parkinson's starts years before the tremor and stiffness that lead to a diagnosis. In that early phase people often act out their dreams, lose their sense of smell, become constipated, and move a little more slowly, and most of them never connect these signs. The International Parkinson and Movement Disorder Society published research criteria that combine exactly these markers into a probability, but nobody outside a research clinic uses them. Motus brings that model to anyone with a phone, in English and Spanish, with every instruction read aloud.

For people who already have Parkinson's, the hardest question at a neurology visit is what happens between doses. Patients are asked to remember it. Motus measures it.

## The five tests

Finger tapping follows the finger tapping item of the MDS-UPDRS motor exam. The front camera tracks 21 points on the hand, and Motus measures the gap between thumb and index finger in centimeters, tap by tap, for ten seconds per hand. It reports speed, size, rhythm, pauses, and whether the taps shrink as the person keeps going. That shrinking, called the sequence effect, is a hallmark of the slowness of Parkinson's, and Motus tests it with a regression across all taps rather than by eye.

The tremor test watches both hands resting and then held out. Motus resamples the hand motion onto an even clock, filters it, and computes a power spectrum. A tremor counts when one narrow frequency holds most of the motion and the movement is large enough to matter. Motus counts a rest tremor between 3.5 and 7.5 beats per second as Parkinson's range, a window around the 4 to 6 beats per second typical of the disease.

The face test counts blinks during thirty relaxed seconds and then prompts the person to smile and raise their eyebrows. Facial expression and blink rate both tend to drop in Parkinson's.

The voice test has three parts. A held vowel measures pitch steadiness and voice clarity, rapid pa-ta-ka repetition measures syllable rate, and a short reading measures how much the pitch rises and falls. Flat, monotone speech is one of the earliest changes researchers have measured in untreated Parkinson's.

The spiral test asks the person to trace a spiral with each hand. Motus measures the distance from the guide line and looks for tremor in the drawing itself.

## How the risk estimate works

Motus implements the MDS research criteria for prodromal Parkinson's disease (Berg et al., 2015) with the likelihood ratios from the 2019 update (Heinzel et al., 2019). The estimate starts from the published probability that a person of that age is in the prodromal phase. Each answer then multiplies the odds by its likelihood ratio, so acting out dreams raises them and regular coffee lowers them slightly. The five movement tests count together as the criteria's quantitative motor testing marker, which counts as abnormal only when at least half of the completed tests show a finding. Answers of not sure are left out.

The result lands in one of three levels. Motus sets its own cutoffs for these levels. The top level needs an estimated probability of at least 30 percent, the lower bound the MDS task force suggested for possible prodromal disease (Berg et al., 2014), and it also needs prodromal markers with a combined likelihood ratio of at least 14, so risk factors such as age or family history can never reach it alone. The middle level means the estimate reached at least 5 percent and at least double the starting probability for that age. The app shows the person which answers and tests moved the result and how strongly, while the exact probability appears only on the doctor report, where a clinician can read it in context. The risk estimate covers adults 50 and older because the criteria define no prior below that age. Younger people still get every test result.

Self-reported smell loss is shown but not counted, because the criteria require an objective smell test.

## Tracking for people with Parkinson's

The one-minute check repeats the finger tapping test on both hands and the resting tremor test. The person logs each dose with one tap. After a few days Motus plots tapping speed by the hours since the last dose, and the curve shows when medication starts working, when it peaks, and when it wears off. A printable report summarizes the averages for each hour after a dose. The Show example data button on the tracking screen fills in ten days of realistic sample data so the charts can be explored right away.

## Exercises

Every exercise has two parts. The first part measures how the person moves today, and the second part sets a target a little past that measurement and gives live feedback while they practice. Each session is saved, so the exercise page shows the last result, the best result, and a chart of every session.

The walking rhythm coach counts steps with the phone's motion sensor during 30 seconds of normal walking, then plays a beat about 10 percent faster than that pace for a minute. Walking to a steady beat is a standard physical therapy cue for the short, shuffling steps of Parkinson's (Nieuwboer et al., 2007). The screen stays awake during the walk, and a safety note asks the person to walk only on a clear path with someone nearby if their balance is unsteady.

The voice loudness trainer measures the person's normal speaking volume while they read a sentence, then sets a target 6 decibels louder and shows a live bar during four loud repetitions. It follows the idea behind LSVT LOUD, a speech therapy that trains people with Parkinson's to speak louder until the louder voice feels normal (Ramig et al., 2001).

Big movement practice uses the camera to find how widely the person moves their hands, then places eight targets a quarter wider than that natural reach. It follows LSVT BIG, a physical therapy built on deliberately oversized movement (Ebersbach et al., 2010).

Tapping with live feedback repeats the finger tapping test, sets a target from the person's own best taps, and shows the size of every tap against that target, so they can see their taps shrinking and push them back to full size.

Handwriting with guide lines has the person write a row of loops without help, then again between two guide lines set from their first loops, and compares how much the writing shrinks across the row each time. Visual guide lines are a studied way to reduce the small, shrinking handwriting of Parkinson's (Oliveira et al., 1997).

Face exercises prompt six big expressions, two each of smiling, raising the eyebrows, and opening the mouth wide. The face tracker scores how full each expression was.

## Privacy

The camera and microphone are analyzed frame by frame in the browser and never recorded. Answers and results are stored only in the browser's local storage on that device so a person can compare results over time, and the Erase all my data button on the How Motus works page deletes them. The only network requests after the page loads download the hand and face tracking models from Google.

## Accessibility

The interface uses Atkinson Hyperlegible Next, a typeface the Braille Institute designed for readers with low vision, with large tap targets and high contrast. Every instruction can be read aloud, and the whole app, including the doctor report, works in Spanish.

## Running it

Motus is a static web app with no build step. Camera and microphone access require HTTPS or localhost, so serve the folder with any local web server and open it in a current version of Chrome, Safari, Edge, or Firefox.

```
cd motus
python3 -m http.server 8000
```

Then open http://localhost:8000 on the same computer. To test on a phone, deploy it to GitHub Pages as described below.

Adding ?simulate=1 to the address runs the whole app with a synthetic camera, microphone, motion sensor, and drawing, which is how the interface was tested without a person in front of the camera. For example, http://localhost:8000/?simulate=1 starts the simulated version.

The signal processing and scoring have automated tests that run with Node 18 or newer.

```
npm test
```

## Deploying to GitHub Pages

1. Create a new public repository on GitHub and upload the contents of this folder to it, keeping the folder structure.
2. In the repository, open Settings, then Pages.
3. Under Build and deployment, choose Deploy from a branch, pick the main branch and the root folder, and save.
4. After a minute or two, GitHub shows the address of the live site. Open it on a phone and allow camera and microphone access when asked.

## Project structure

The js/analysis folder holds the measurement code for each test, and js/dsp.js holds the signal processing it relies on, including filtering, spectra, peak finding, pitch tracking, and statistics. The js/capture folder handles the camera, the hand and face trackers, and the microphone. The js/exercises folder holds the six exercises, and the js/views folder holds every screen. The js/screening.js file implements the risk model, and js/track-data.js handles the tracking data. The tests folder checks the analysis against synthetic signals with known answers.

## Limits

Motus is a student-built research prototype and has not been tested in a clinical study. Its movement thresholds come from patterns described in the medical literature rather than from a validation study of this app, and the MDS criteria were designed for research rather than for screening the public. Lighting, camera angle, and background noise all affect the measurements, and conditions such as essential tremor or medication side effects can produce similar findings. Motus does not diagnose Parkinson's disease, and its results should be interpreted by a clinician.

## References

Berg, D., Postuma, R. B., Adler, C. H., et al. (2015). MDS research criteria for prodromal Parkinson's disease. Movement Disorders, 30(12), 1600-1611. https://doi.org/10.1002/mds.26431

Heinzel, S., Berg, D., Gasser, T., et al. (2019). Update of the MDS research criteria for prodromal Parkinson's disease. Movement Disorders, 34(10), 1464-1470. https://doi.org/10.1002/mds.27802

Berg, D., Postuma, R. B., Bloem, B., et al. (2014). Time to redefine PD? Introductory statement of the MDS Task Force on the definition of Parkinson's disease. Movement Disorders, 29(4), 454-462. https://doi.org/10.1002/mds.25844

Postuma, R. B., Arnulf, I., Hogl, B., et al. (2012). A single-question screen for rapid eye movement sleep behavior disorder: A multicenter validation study. Movement Disorders, 27(7), 913-916. https://doi.org/10.1002/mds.25037

Goetz, C. G., Tilley, B. C., Shaftman, S. R., et al. (2008). Movement Disorder Society-sponsored revision of the Unified Parkinson's Disease Rating Scale (MDS-UPDRS): Scale presentation and clinimetric testing results. Movement Disorders, 23(15), 2129-2170. https://doi.org/10.1002/mds.22340

Rusz, J., Cmejla, R., Ruzickova, H., & Ruzicka, E. (2011). Quantitative acoustic measurements for characterization of speech and voice disorders in early untreated Parkinson's disease. The Journal of the Acoustical Society of America, 129(1), 350-367. https://doi.org/10.1121/1.3514381

Bot, B. M., Suver, C., Neto, E. C., et al. (2016). The mPower study, Parkinson disease mobile data collected using ResearchKit. Scientific Data, 3, 160011. https://doi.org/10.1038/sdata.2016.11

Nieuwboer, A., Kwakkel, G., Rochester, L., et al. (2007). Cueing training in the home improves gait-related mobility in Parkinson's disease: The RESCUE trial. Journal of Neurology, Neurosurgery and Psychiatry, 78(2), 134-140. https://doi.org/10.1136/jnnp.200X.097923

Ramig, L. O., Sapir, S., Countryman, S., et al. (2001). Intensive voice treatment (LSVT) for patients with Parkinson's disease: A 2 year follow up. Journal of Neurology, Neurosurgery and Psychiatry, 71(4), 493-498. https://doi.org/10.1136/jnnp.71.4.493

Ebersbach, G., Ebersbach, A., Edler, D., et al. (2010). Comparing exercise in Parkinson's disease, the Berlin LSVT BIG study. Movement Disorders, 25(12), 1902-1908. https://doi.org/10.1002/mds.23212

Oliveira, R. M., Gurd, J. M., Nixon, P., Marshall, J. C., & Passingham, R. E. (1997). Micrographia in Parkinson's disease: The effect of providing external cues. Journal of Neurology, Neurosurgery and Psychiatry, 63(4), 429-433. https://doi.org/10.1136/jnnp.63.4.429

Lugaresi, C., Tang, J., Nash, H., et al. (2019). MediaPipe: A framework for building perception pipelines. arXiv preprint 1906.08172. https://arxiv.org/abs/1906.08172

## Third-party software

The hand and face trackers come from MediaPipe Tasks Vision 1.1.1 by Google, included unmodified in vendor/mediapipe under the Apache License 2.0. The typeface is Atkinson Hyperlegible Next by the Braille Institute, included in fonts under the SIL Open Font License 1.1.
