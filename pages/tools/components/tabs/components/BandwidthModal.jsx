/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const BandwidthModal = ( {
	showBandwidthModal,
	attachmentDetails,
	modalSelection,
	setModalSelection,
	availableBandwidthGB,
	onClose,
	onProceed,
} ) => {
	if ( ! showBandwidthModal ) {
		return null;
	}

	return (
		<Modal
			title={ __( 'Select Media to Retranscode', 'godam' ) }
			onRequestClose={ onClose }
			isOpen={ showBandwidthModal }
		>
			<div style={ { maxHeight: 400, overflowY: 'auto' } }>
				{ attachmentDetails.map( ( att ) => {
					const attGB = ( att.size || 0 ) / 1024 / 1024 / 1024;
					const checked = modalSelection.includes( att.id );
					// Calculate running total if this is checked
					const newTotal = modalSelection
						.filter( ( id ) => id !== att.id )
						.reduce( ( sum, id ) => {
							const found = attachmentDetails.find( ( a ) => a.id === id );
							return sum + ( ( found?.size || 0 ) / 1024 / 1024 / 1024 );
						}, checked ? 0 : attGB );
					const disabled = ! checked && ( newTotal + attGB > availableBandwidthGB );

					return (
						<div key={ att.id } style={ { marginBottom: 8 } }>
							<input
								type="checkbox"
								checked={ checked }
								disabled={ disabled }
								onChange={ () => {
									setModalSelection( ( sel ) =>
										checked ? sel.filter( ( id ) => id !== att.id ) : [ ...sel, att.id ],
									);
								} }
							/>
							{ att.name } ({ ( att.size / 1024 / 1024 ).toFixed( 2 ) } MB)
						</div>
					);
				} ) }
				<div style={ { marginTop: 16 } }>
					<strong>{ __( 'Required Bandwidth:', 'godam' ) }</strong> { modalSelection.reduce( ( sum, id ) => {
						const att = attachmentDetails.find( ( a ) => a.id === id );
						return sum + ( ( att?.size || 0 ) / 1024 / 1024 / 1024 );
					}, 0 ).toFixed( 2 ) } GB / { availableBandwidthGB.toFixed( 2 ) } GB { __( 'available', 'godam' ) }
				</div>
				<Button
					variant="primary"
					style={ { marginTop: 16 } }
					className="godam-button"
					onClick={ onProceed }
				>
					{ __( 'Proceed', 'godam' ) }
				</Button>
			</div>
		</Modal>
	);
};

export default BandwidthModal;
