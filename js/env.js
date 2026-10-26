const params = new URLSearchParams(window.location.search);

export function isSimulated()
{
    return params.get("simulate") === "1";
}
