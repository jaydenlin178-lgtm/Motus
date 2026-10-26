import { h, toast } from "../ui.js";
import { icon } from "../icons.js";
import { t } from "../i18n.js";
import { eraseEverything } from "../store.js";

const REFERENCES =
[
    { text: "Berg, D., Postuma, R. B., Adler, C. H., et al. (2015). MDS research criteria for prodromal Parkinson's disease. Movement Disorders, 30(12), 1600-1611.", link: "doi.org/10.1002/mds.26431" },
    { text: "Heinzel, S., Berg, D., Gasser, T., et al. (2019). Update of the MDS research criteria for prodromal Parkinson's disease. Movement Disorders, 34(10), 1464-1470.", link: "doi.org/10.1002/mds.27802" },
    { text: "Berg, D., Postuma, R. B., Bloem, B., et al. (2014). Time to redefine PD? Introductory statement of the MDS Task Force on the definition of Parkinson's disease. Movement Disorders, 29(4), 454-462.", link: "doi.org/10.1002/mds.25844" },
    { text: "Postuma, R. B., Arnulf, I., Hogl, B., et al. (2012). A single-question screen for rapid eye movement sleep behavior disorder: A multicenter validation study. Movement Disorders, 27(7), 913-916.", link: "doi.org/10.1002/mds.25037" },
    { text: "Goetz, C. G., Tilley, B. C., Shaftman, S. R., et al. (2008). Movement Disorder Society-sponsored revision of the Unified Parkinson's Disease Rating Scale (MDS-UPDRS): Scale presentation and clinimetric testing results. Movement Disorders, 23(15), 2129-2170.", link: "doi.org/10.1002/mds.22340" },
    { text: "Rusz, J., Cmejla, R., Ruzickova, H., & Ruzicka, E. (2011). Quantitative acoustic measurements for characterization of speech and voice disorders in early untreated Parkinson's disease. The Journal of the Acoustical Society of America, 129(1), 350-367.", link: "doi.org/10.1121/1.3514381" },
    { text: "Bot, B. M., Suver, C., Neto, E. C., et al. (2016). The mPower study, Parkinson disease mobile data collected using ResearchKit. Scientific Data, 3, 160011.", link: "doi.org/10.1038/sdata.2016.11" },
    { text: "Nieuwboer, A., Kwakkel, G., Rochester, L., et al. (2007). Cueing training in the home improves gait-related mobility in Parkinson's disease: The RESCUE trial. Journal of Neurology, Neurosurgery and Psychiatry, 78(2), 134-140.", link: "doi.org/10.1136/jnnp.200X.097923" },
    { text: "Ramig, L. O., Sapir, S., Countryman, S., et al. (2001). Intensive voice treatment (LSVT) for patients with Parkinson's disease: A 2 year follow up. Journal of Neurology, Neurosurgery and Psychiatry, 71(4), 493-498.", link: "doi.org/10.1136/jnnp.71.4.493" },
    { text: "Ebersbach, G., Ebersbach, A., Edler, D., et al. (2010). Comparing exercise in Parkinson's disease, the Berlin LSVT BIG study. Movement Disorders, 25(12), 1902-1908.", link: "doi.org/10.1002/mds.23212" },
    { text: "Oliveira, R. M., Gurd, J. M., Nixon, P., Marshall, J. C., & Passingham, R. E. (1997). Micrographia in Parkinson's disease: The effect of providing external cues. Journal of Neurology, Neurosurgery and Psychiatry, 63(4), 429-433.", link: "doi.org/10.1136/jnnp.63.4.429" },
    { text: "Lugaresi, C., Tang, J., Nash, H., et al. (2019). MediaPipe: A framework for building perception pipelines. arXiv preprint 1906.08172.", link: "arxiv.org/abs/1906.08172" }
];

export function learnView(context)
{
    const tests =
    [
        ["hand", "test.tapping.name", "learn.tests.tapping"],
        ["tremor", "test.tremor.name", "learn.tests.tremor"],
        ["face", "test.face.name", "learn.tests.face"],
        ["mic", "test.voice.name", "learn.tests.voice"],
        ["spiral", "test.spiral.name", "learn.tests.spiral"]
    ];
    const eraseButton = h("button",
    {
        class: "button button-secondary",
        type: "button",
        onClick: () =>
        {
            if (window.confirm(t("learn.privacy.confirm")))
            {
                eraseEverything();
                toast(t("learn.privacy.erased"));
                context.navigate("");
            }
        }
    }, icon("trash"), t("learn.privacy.erase"));
    return h("article", { class: "prose" },
        h("button", { class: "back-link", type: "button", onClick: () => history.length > 1 ? history.back() : context.navigate("") }, icon("back"), t("nav.back")),
        h("h1", null, t("learn.title")),
        h("p", { class: "lede", style: { marginTop: "14px" } }, t("learn.lede")),
        h("h2", null, t("learn.tests.title")),
        h("ul", { class: "test-list is-detailed" }, tests.map(([iconName, nameKey, bodyKey]) =>
            h("li", null,
                h("span", { class: "icon-cell" }, icon(iconName)),
                h("div", null, h("strong", null, t(nameKey)), h("span", { class: "meta" }, t(bodyKey)))))),
        h("h2", null, t("learn.risk.title")),
        h("p", null, t("learn.risk.p1")),
        h("p", null, t("learn.risk.p2")),
        h("p", null, t("learn.risk.p3")),
        h("p", null, t("learn.risk.p5")),
        h("p", null, t("learn.risk.p6")),
        h("p", null, t("learn.risk.p4")),
        h("h2", null, t("learn.ex.title")),
        h("p", null, t("learn.ex.p1")),
        h("p", null, t("learn.ex.p2")),
        h("h2", { id: "privacy" }, t("learn.privacy.title")),
        h("p", null, t("learn.privacy.p1")),
        h("p", null, t("learn.privacy.p2")),
        h("div", { class: "actions" }, eraseButton),
        h("h2", null, t("learn.limits.title")),
        h("p", null, t("learn.limits.p1")),
        h("p", null, t("learn.limits.p2")),
        h("h2", null, t("learn.refs.title")),
        h("ol", { class: "references" }, REFERENCES.map((ref) => h("li", null, ref.text, " ", h("a", { href: "https://" + ref.link, rel: "noopener", target: "_blank" }, ref.link)))));
}
