/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

/**
 * Shown instead of a settings panel when a saved layer's type isn't registered,
 * usually because the add-on that provides it isn't active. The layer is kept
 * as it was, and can only be deleted (RFC D2).
 *
 * @param {Object}   props          Props.
 * @param {Object}   props.layer    The saved layer.
 * @param {Function} props.goBack   Return to the layer list.
 * @param {Function} props.onDelete Delete the layer.
 * @return {JSX.Element} The notice.
 */
const UnregisteredLayerNotice = ( { layer, goBack, onDelete } ) => (
	<div className="godam-layer-error godam-layer-unregistered" role="alert" data-test-id="godam-video-editor-unregistered-layer">
		<p>
			{ __( 'This layer needs an add-on that isn\'t active. It is kept as it was; activate the add-on to edit it, or delete it.', 'godam' ) }
		</p>
		<p>
			<code>{ layer?.type }</code>
		</p>
		{ onDelete && (
			<Button variant="secondary" isDestructive onClick={ onDelete }>
				{ __( 'Delete layer', 'godam' ) }
			</Button>
		) }
		{ goBack && (
			<Button variant="tertiary" onClick={ goBack }>
				{ __( 'Back to layers', 'godam' ) }
			</Button>
		) }
	</div>
);

export default UnregisteredLayerNotice;
