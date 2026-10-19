/**
 * WordPress dependencies
 */
import { TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Marketo integration extended settings.
 *
 * Rendered inside the Integrations → Marketo tab via the
 * `window.godamIntegrationComponents.marketo` seam (see `IntegrationsSettings.jsx`).
 * Collects the credentials needed to render a Marketo form inside a video layer:
 * the instance Pod ID, the Munchkin (account) ID and an optional reCAPTCHA key.
 *
 * @param {Object}   props
 * @param {Object}   props.settings        Current `integrations.marketo` settings object.
 * @param {Function} props.onSettingChange Called with `(key, value)` to update a field.
 * @return {JSX.Element} The Marketo settings fields.
 */
const MarketoSettings = ( { settings = {}, onSettingChange } ) => {
	return (
		<div className="godam-marketo-settings">
			<TextControl
				className="mb-4"
				label={ __( 'Pod ID / Instance host', 'godam' ) }
				help={ __( 'Your Marketo instance host, e.g. "app-sj04.marketo.com" or "123-ABC-456.mktoweb.com". Find it in Marketo under Admin → Landing Pages, or in your form embed code. A bare ID without a dot is treated as "<id>.mktoweb.com".', 'godam' ) }
				value={ settings?.podId || '' }
				onChange={ ( value ) => onSettingChange( 'podId', value ) }
				data-test-id="godam-settings-marketo-control-pod-id"
			/>

			<TextControl
				className="mb-4"
				label={ __( 'Munchkin ID', 'godam' ) }
				help={ __( 'Your Marketo Munchkin (account) ID, e.g. "123-ABC-456".', 'godam' ) }
				value={ settings?.munchkinId || '' }
				onChange={ ( value ) => onSettingChange( 'munchkinId', value ) }
				data-test-id="godam-settings-marketo-control-munchkin-id"
			/>

			<TextControl
				className="mb-4"
				label={ __( 'reCAPTCHA Site Key (optional)', 'godam' ) }
				help={ __( 'Google reCAPTCHA v3 site key, only needed if your Marketo forms use reCAPTCHA. Leave blank otherwise.', 'godam' ) }
				value={ settings?.recaptchaKey || '' }
				onChange={ ( value ) => onSettingChange( 'recaptchaKey', value ) }
				data-test-id="godam-settings-marketo-control-recaptcha-key"
			/>
		</div>
	);
};

export default MarketoSettings;
