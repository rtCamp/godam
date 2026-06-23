/**
 * WordPress dependencies
 */
import { Button, Notice } from '@wordpress/components';
import { pencil } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { VeSection, VeCustomSelect } from '../controls';
import FormSelector from './FormSelector';
import AjaxWarning from './AjaxWarning';

/**
 * Shared configuration fields for every form-plugin layer: an inactive-plugin
 * notice, the "Select form" picker and (when the plugin supports it) a theme
 * selector. Grouped in a single `Form` section so all form layers share the
 * same layout.
 *
 * The optional `theme` prop is an object `{ value, options, onChange }`; when
 * omitted the theme selector is hidden.
 *
 * @param {Object}   props                     Props.
 * @param {boolean}  props.isActive            Whether the form plugin is active.
 * @param {string}   props.pluginLabel         Human label for the plugin (used in the notice).
 * @param {string}   [props.formType]          Form-plugin type (e.g. 'gravity'); enables the AJAX notice.
 * @param {string}   props.formID              Currently selected form ID.
 * @param {Array}    props.forms               `[{ value, label }]` options for the picker.
 * @param {Function} props.onSelectForm        Receives the chosen form ID.
 * @param {string}   [props.selectorClassName] Extra class on the form picker.
 * @param {Object}   [props.theme]             Theme selector config, omit to hide.
 * @param {string}   [props.editUrl]           Admin URL for the "Edit Form" button.
 * @param {boolean}  [props.showEditButton]    Whether to render the "Edit Form" button.
 * @return {JSX.Element} The form fields section.
 */
const FormFields = ( {
	isActive,
	pluginLabel,
	formType,
	formID,
	forms,
	onSelectForm,
	selectorClassName = '',
	theme,
	editUrl,
	showEditButton = false,
} ) => (
	<VeSection title={ __( 'Form', 'godam' ) }>
		{ ! isActive && (
			<Notice
				className="mb-4"
				status="warning"
				isDismissible={ false }
			>
				{ sprintf(
					/* translators: %s is the form plugin name, e.g. "Gravity Forms". */
					__( 'Please activate the %s plugin to use this feature.', 'godam' ),
					pluginLabel,
				) }
			</Notice>
		) }

		<FormSelector
			disabled={ ! isActive }
			className={ `${ selectorClassName }`.trim() }
			formID={ formID }
			forms={ forms }
			handleChange={ onSelectForm }
		/>

		{ theme && (
			<VeCustomSelect
				label={ __( 'Select Theme', 'godam' ) }
				options={ theme.options }
				value={ theme.value }
				onChange={ theme.onChange }
				disabled={ ! isActive }
			/>
		) }

		{ showEditButton && editUrl && (
			<Button
				href={ editUrl }
				target="_blank"
				variant="secondary"
				icon={ pencil }
				className="godam-ve-edit-form w-full justify-center"
			>
				{ __( 'Edit Form', 'godam' ) }
			</Button>
		) }

		{ formType && (
			<AjaxWarning formType={ formType } formId={ formID } />
		) }
	</VeSection>
);

export default FormFields;
