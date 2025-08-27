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

	const overLimit = totalRequiredGB > availableBandwidthGB;

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
					const attId = parseInt( att.id, 10 );
					const normalizedSelection = modalSelection.map( ( id ) => parseInt( id, 10 ) );
					const isChecked = normalizedSelection.includes( attId );

					return (
						<div key={ att.id } style={ { marginBottom: 8 } }>
							{ /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
							<label
								style={ {
									display: 'flex',
									alignItems: 'center',
									cursor: 'pointer',
								} }
							>
								<input
									type="checkbox"
									checked={ isChecked }
									onChange={ () => handleToggle( attId, isChecked ) }
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
				{ overLimit && (
					<div style={ { color: '#b91c1c', marginTop: 8 } }>
						{ __( 'Your selection exceeds the available bandwidth. Deselect some items to proceed.', 'godam' ) }
					</div>
				) }
				<Button
					variant="primary"
					style={ { marginTop: 16 } }
					className="godam-button"
					onClick={ onProceed }
					disabled={ overLimit || modalSelection.length === 0 }
				>
					{ __( 'Proceed', 'godam' ) }
				</Button>
			</div>
		</Modal>
	);
};

export default BandwidthModal;
