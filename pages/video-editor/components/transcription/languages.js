/**
 * Language options for transcription and caption tracks.
 *
 * Two distinct lists are exported.
 *
 * `TRANSCRIBE_LANGUAGES` drives the "Generate transcription" selector. It leads
 * with Deepgram's detection options (`auto` / `multi`) because that is how
 * multilingual transcription is triggered, then the BCP 47 codes Deepgram
 * `nova-3` transcribes in. The server (`process_transcription`) validates the
 * chosen code before calling Deepgram, so this list only has to stay a sane
 * subset — the server is the source of truth.
 *
 * `CAPTION_LANGUAGES` drives the uploaded-caption language picker. Uploaded
 * captions are NOT limited to what Deepgram can transcribe (someone can upload
 * a Welsh subtitle file), so the UI also allows a free-text code; this list is
 * just the common shortcuts.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Deepgram detection pseudo-languages, offered first in the generate selector.
 *
 * `auto` maps to Deepgram `detect_language`; `multi` enables code-switching on
 * nova-3. Keep the values in sync with what `process_transcription` accepts.
 */
export const DETECTION_OPTIONS = [
	{ value: 'auto', label: __( 'Auto-detect language', 'godam' ) },
	{ value: 'multi', label: __( 'Multiple languages (code-switching)', 'godam' ) },
];

/**
 * BCP 47 language tags shown in both selectors, ordered by rough prevalence.
 *
 * `label` is the English display name; the BCP 47 `value` is what the API
 * stores and what the player's `srclang` uses.
 */
export const BCP47_LANGUAGES = [
	{ value: 'en', label: __( 'English', 'godam' ) },
	{ value: 'es', label: __( 'Spanish', 'godam' ) },
	{ value: 'fr', label: __( 'French', 'godam' ) },
	{ value: 'de', label: __( 'German', 'godam' ) },
	{ value: 'hi', label: __( 'Hindi', 'godam' ) },
	{ value: 'pt', label: __( 'Portuguese', 'godam' ) },
	{ value: 'pt-BR', label: __( 'Portuguese (Brazil)', 'godam' ) },
	{ value: 'it', label: __( 'Italian', 'godam' ) },
	{ value: 'nl', label: __( 'Dutch', 'godam' ) },
	{ value: 'ja', label: __( 'Japanese', 'godam' ) },
	{ value: 'ko', label: __( 'Korean', 'godam' ) },
	{ value: 'zh', label: __( 'Chinese', 'godam' ) },
	{ value: 'ru', label: __( 'Russian', 'godam' ) },
	{ value: 'ar', label: __( 'Arabic', 'godam' ) },
	{ value: 'tr', label: __( 'Turkish', 'godam' ) },
	{ value: 'pl', label: __( 'Polish', 'godam' ) },
	{ value: 'sv', label: __( 'Swedish', 'godam' ) },
	{ value: 'id', label: __( 'Indonesian', 'godam' ) },
	{ value: 'uk', label: __( 'Ukrainian', 'godam' ) },
	{ value: 'cy', label: __( 'Welsh', 'godam' ) },
];

/**
 * Options for the "Generate transcription" language selector:
 * detection options first, then the transcribable languages.
 */
export const TRANSCRIBE_LANGUAGES = [ ...DETECTION_OPTIONS, ...BCP47_LANGUAGES ];

/**
 * Options for the uploaded-caption language picker (no detection pseudo-codes).
 */
export const CAPTION_LANGUAGES = BCP47_LANGUAGES;

/**
 * Resolve a language code to a human label, falling back to the code itself for
 * anything not in the table (e.g. a free-text or uploaded code).
 *
 * @param {string} code BCP 47 tag or detection keyword.
 * @return {string} Display label.
 */
export const languageLabel = ( code ) => {
	if ( ! code ) {
		return '';
	}
	const match = TRANSCRIBE_LANGUAGES.find( ( option ) => option.value === code );
	return match ? match.label : code;
};
