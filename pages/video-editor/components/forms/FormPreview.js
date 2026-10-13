/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { chevronRight } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import LayerControl from '../LayerControls';

/**
 * Shared preview for every form-plugin layer.
 *
 * Renders the coloured layer backdrop, the form body, and the optional "Skip"
 * button so all form layers look and behave the same.
 *
 * The body comes from one of two sources. `html` is a string rendered via
 * `dangerouslySetInnerHTML` (used by plugins whose preview is fetched as
 * markup), with loading / error states handled here from `isFetching` /
 * `error`. `children` is a custom node (e.g. an iframe preview or a bespoke
 * empty state) that fully controls its own loading; when provided it takes
 * precedence over `html`.
 *
 * @param {Object}      props                      Props.
 * @param {string}      [props.bgColor]            Layer background colour.
 * @param {boolean}     [props.allowSkip]          Whether to render the Skip button.
 * @param {boolean}     [props.isFetching]         Loading state (only used with `html`).
 * @param {string}      [props.error]              Error message (only used with `html`).
 * @param {string}      [props.html]               Form markup to render.
 * @param {string}      [props.containerClassName] Extra class on the `.form-container`.
 * @param {JSX.Element} [props.children]           Custom body node (overrides `html`).
 * @return {JSX.Element} Preview element.
 */
const FormPreview = ( {
	bgColor,
	allowSkip = false,
	isFetching = false,
	error = '',
	html = '',
	containerClassName = '',
	children,
} ) => {
	const body = children ?? (
		<>
			{ isFetching && (
				<div className="form-container">
					<p>{ __( 'Loading form…', 'godam' ) }</p>
				</div>
			) }

			{ ! isFetching && error && (
				<div className="form-container">
					<p>{ error }</p>
				</div>
			) }

			{ ! isFetching && ! error && html && (
				<div
					className={ `form-container ${ containerClassName }`.trim() }
					dangerouslySetInnerHTML={ { __html: html } }
				/>
			) }
		</>
	);

	return (
		<LayerControl>
			<>
				<div
					className="easydam-layer"
					style={ { backgroundColor: bgColor } }
				>
					{ body }
				</div>

				{ allowSkip && (
					<Button
						className="skip-button"
						variant="primary"
						icon={ chevronRight }
						iconSize="18"
						iconPosition="right"
					>
						{ __( 'Skip', 'godam' ) }
					</Button>
				) }
			</>
		</LayerControl>
	);
};

export default FormPreview;
