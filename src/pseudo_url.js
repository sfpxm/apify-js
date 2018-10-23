import _ from 'underscore';
import log from 'apify-shared/log';
import { checkParamOrThrow } from 'apify-client/build/utils';
import Request from './request';

/**
 * Parses PURL into Regex string.
 * @ignore
 */
const parsePurl = (purl) => {
    const trimmedPurl = purl.trim();
    if (trimmedPurl.length === 0) throw new Error(`Cannot parse PURL '${trimmedPurl}': it must be an non-empty string`);

    let regex = '^';

    try {
        let openBrackets = 0;
        for (let i = 0; i < trimmedPurl.length; i++) {
            const ch = trimmedPurl.charAt(i);

            if (ch === '[' && ++openBrackets === 1) {
                // Beginning of '[regex]' section
                // Enclose regex in () brackets to enforce operator priority
                regex += '(';
            } else if (ch === ']' && openBrackets > 0 && --openBrackets === 0) {
                // End of '[regex]' section
                regex += ')';
            } else if (openBrackets > 0) {
                // Inside '[regex]' section
                regex += ch;
            } else {
                // Outside '[regex]' section, parsing the URL part
                const code = ch.charCodeAt(0);
                if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
                    // Alphanumeric character => copy it.
                    regex += ch;
                } else {
                    // Special character => escape it
                    const hex = code < 16 ? `0${code.toString(16)}` : code.toString(16);
                    regex += `\\x${hex}`;
                }
            }
        }
        regex += '$';
    } catch (err) {
        throw new Error(`Cannot parse PURL '${purl}': ${err}`);
    }

    return regex;
};

/**
 * Represents a pseudo URL (PURL) - an URL pattern used by web crawlers
 * to specify which URLs should the crawler visit.
 * This class is used by the [utils.puppeteer.enqueueLinks()](puppeteer#puppeteer.enqueueLinks) function.
 *
 * A PURL is simply a URL with special directives enclosed in `[]` brackets.
 * Currently, the only supported directive is `[RegExp]`,
 * which defines a JavaScript-style regular expression to match against the URL.
 *
 * For example, a PURL `http://www.example.com/pages/[(\w|-)*]` will match all of the following URLs:
 *
 * <ul>
 *     <li><code>http://www.example.com/pages/</code></li>
 *     <li><code>http://www.example.com/pages/my-awesome-page</code></li>
 *     <li><code>http://www.example.com/pages/something</code></li>
 * </ul>
 *
 * If either `[` or `]` is part of the normal query string, it must be encoded as `[\x5B]` or `[\x5D]`,
 * respectively. For example, the following PURL:
 * ```http
 * http://www.example.com/search?do[\x5B]load[\x5D]=1
 * ```
 * will match the URL:
 * ```http
 * http://www.example.com/search?do[load]=1
 * ```
 *
 * **Example usage:**
 *
 * ```javascript
 * const purl = new Apify.PseudoUrl('http://www.example.com/pages/[(\w|-)*]');
 *
 * if (purl.matches('http://www.example.com/pages/my-awesome-page')) console.log('Match!');
 * ```
 *
 * @param {String} purl
 *   Pseudo URL.
 * @param {Object} requestTemplate
 *   Options for the new {@link Request} instances created for matching URLs.
 */
class PseudoUrl {
    constructor(purl, requestTemplate = {}) {
        checkParamOrThrow(purl, 'purl', 'String');
        checkParamOrThrow(requestTemplate, 'requestTemplate', 'Object');

        const regex = parsePurl(purl);

        log.debug('PURL parsed', { purl, regex });

        this.regex = new RegExp(regex);
        this.requestTemplate = requestTemplate;
    }

    /**
     * Determines whether a URL matches this pseudo-URL pattern.
     *
     * @param {String} url URL to be matched.
     * @return {Boolean} Returns `true` if given URL matches pseudo URL.
     */
    matches(url) {
        return _.isString(url) && url.match(this.regex) !== null;
    }

    /**
     * Creates a Request object from requestTemplate and given URL.
     *
     * @param {String} url
     * @return {Request}
     */
    createRequest(url) {
        return new Request(Object.assign({ url }, this.requestTemplate));
    }
}

export default PseudoUrl;
