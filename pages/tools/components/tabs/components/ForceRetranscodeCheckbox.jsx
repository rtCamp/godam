/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

const ForceRetranscodeCheckbox = ( { forceRetranscode, setForceRetranscode } ) => {
	return (
		<div style={ { marginBottom: '1em' } }>
			{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
			<label>
				<input
					type="checkbox"
					checked={ forceRetranscode }
					onChange={ ( e ) => setForceRetranscode( e.target.checked ) }
					style={ { marginRight: '0.5em' } }
				/>
				{ __( 'Force retranscode (even if already transcoded)', 'godam' ) }
			</label>
		</div>
	);
};

export default ForceRetranscodeCheckbox;
