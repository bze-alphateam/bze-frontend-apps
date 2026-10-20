/** Every CSS rule Chakra emitted (as <style> text or inserted rules) for one of the element's classes. */
export function rulesFor(el: HTMLElement): string {
    const text = Array.from(document.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n');
    const inserted = Array.from(document.styleSheets).flatMap((sheet) => {
        try {
            return Array.from(sheet.cssRules).map((rule) => rule.cssText);
        } catch {
            return [];
        }
    });
    return [...text.split('}'), ...inserted]
        .filter((rule) => Array.from(el.classList).some((cls) => rule.includes(`.${cls}`)))
        .join('\n');
}
