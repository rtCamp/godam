/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useCallback, useMemo } from '@wordpress/element';

const BandwidthModal = ( {
	showBandwidthModal,
	attachmentDetails,
	modalSelection,
	setModalSelection,
	availableBandwidthGB,
	onClose,
	onProceed,
} ) => {
	const handleToggle = useCallback( ( attId, isChecked ) => {
		setModalSelection( ( prevSelection ) => {
			if ( isChecked ) {
				// Remove from selection
				return prevSelection.filter( ( id ) => parseInt( id, 10 ) !== attId );
			}
			// Add to selection
			return [ ...prevSelection, attId ];
		} );
	}, [ setModalSelection ] );

	const totalRequiredGB = useMemo( () => {
		return modalSelection.reduce( ( sum, id ) => {
			const att = attachmentDetails.find( ( a ) => parseInt( a.id, 10 ) === parseInt( id, 10 ) );
			return sum + ( ( att?.size || 0 ) / 1024 / 1024 / 1024 );
		}, 0 );
	}, [ modalSelection, attachmentDetails ] );

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
					const attId = parseInt( att.id, 10 );
					const normalizedSelection = modalSelection.map( ( id ) => parseInt( id, 10 ) );
					const isChecked = normalizedSelection.includes( attId );

					// Calculate current total without this item
					const currentTotal = normalizedSelection
						.filter( ( id ) => id !== attId )
						.reduce( ( sum, id ) => {
							const found = attachmentDetails.find( ( a ) => parseInt( a.id, 10 ) === id );
							return sum + ( ( found?.size || 0 ) / 1024 / 1024 / 1024 );
						}, 0 );

					// If not checked, would adding this item exceed the limit?
					const wouldExceedLimit = ! isChecked && ( currentTotal + attGB > availableBandwidthGB );
					const isDisabled = wouldExceedLimit;

					return (
						<div key={ att.id } style={ { marginBottom: 8 } }>
							{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
							<label
								style={ {
									display: 'flex',
									alignItems: 'center',
									opacity: isDisabled ? 0.6 : 1,
									cursor: isDisabled ? 'not-allowed' : 'pointer',
								} }
							>
								<input
									type="checkbox"
									checked={ isChecked }
									disabled={ isDisabled }
									onChange={ ( e ) => {
										e.stopPropagation();
										if ( ! isDisabled ) {
											handleToggle( attId, isChecked );
										}
									} }
									style={ { marginRight: 8 } }
								/>
								{ att.name } ({ ( att.size / 1024 / 1024 ).toFixed( 2 ) } MB)
							</label>
						</div>
					);
				} ) }
				<div style={ { marginTop: 16 } }>
					<strong>{ __( 'Required Bandwidth:', 'godam' ) }</strong> { totalRequiredGB.toFixed( 2 ) } GB / { availableBandwidthGB.toFixed( 2 ) } GB { __( 'available', 'godam' ) }
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
