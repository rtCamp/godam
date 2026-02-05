/**
 * External dependencies
 */
import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
/**
 * WordPress dependencies
 */
import { Dropdown, TextControl, Button, Notice } from '@wordpress/components';
import { trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

// Add all free solid icons to the library
library.add( fas );

const FontAwesomeIconPicker = ( { hotspot, disabled = false, index, hotspots, updateField } ) => {
	const [ searchQuery, setSearchQuery ] = useState( '' );
	const [ isOpen, setIsOpen ] = useState( false ); // eslint-disable-line no-unused-vars

	/**
	 * State to manage the notice message and visibility.
	 */
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	/**
	 * To show a notice message.
	 *
	 * @param {string} message Text to display in the notice.
	 * @param {string} status  Status of the notice, can be 'success', 'error', etc.
	 */
	const showNotice = ( message, status = 'success' ) => {
		setNotice( { message, status, isVisible: true } );
	};

	const iconList = Object.values( fas )
		.map( ( icon ) => ( {
			iconName: icon.iconName,
			prefix: icon.prefix,
		} ) )
		.filter(
			( icon, idx, self ) =>
				idx ===
			self.findIndex( ( i ) => i.iconName === icon.iconName ),
		);

	// Filter icons by search query
	const filteredIcons = iconList.filter( ( icon ) =>
		icon.iconName.toLowerCase().includes( searchQuery.toLowerCase() ),
	);

	// Handle reset action
	const handleReset = () => {
		updateField(
			'hotspots',
			hotspots.map( ( h2, j ) =>
				j === index ? { ...h2, icon: null, customIconUrl: null, customIconId: null } : h2,
			),
		);
	};

	// Handle custom icon upload
	const handleUploadCustomIcon = () => {
		const fileFrame = wp.media( {
			title: __( 'Select or Upload Custom Icon', 'godam' ),
			button: {
				text: __( 'Use this icon', 'godam' ),
			},
			library: {
				type: 'image', // Allow all image types
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();

			// Check if the selected file is an image
			if ( attachment.type !== 'image' ) {
				showNotice( __( 'Only Image file is allowed', 'godam' ), 'error' );
				return;
			}

			// Clear any existing notice on successful upload
			setNotice( { message: '', status: 'success', isVisible: false } );

			// Update hotspot with custom icon and clear FontAwesome icon
			updateField(
				'hotspots',
				hotspots.map( ( h2, j ) =>
					j === index
						? {
							...h2,
							customIconUrl: attachment.url,
							customIconId: attachment.id,
							icon: null, // Clear FontAwesome icon when custom icon is selected
						}
						: h2,
				),
			);
		} );

		// If there's already a custom icon selected, pre-select it in the media library
		if ( hotspot.customIconId ) {
			const attachment = wp.media.attachment( hotspot.customIconId );
			attachment.fetch();

			fileFrame.on( 'open', function() {
				const selection = fileFrame.state().get( 'selection' );
				selection.reset();
				selection.add( attachment );
			} );
		}

		fileFrame.open();
	};

	return (
		<div className="flex flex-col gap-2 mt-3">
			<label
				htmlFor={ `hotspot-icon-${ index }` }
				className="text-xs text-gray-700"
			>
				{ __( 'HOTSPOT ICON', 'godam' ) }
			</label>

			<div className="flex items-center gap-2">
				<Dropdown
					renderToggle={ ( { isDropDownOpen, onToggle } ) => (
						<Button
							onClick={ onToggle }
							aria-expanded={ isDropDownOpen }
							variant="secondary"
							size="compact"
							className="flex-grow flex items-center gap-2 godam-button px-3"
							disabled={ disabled }
						>
							{ hotspot.icon ? (
								<>
									<FontAwesomeIcon
										icon={ [ 'fas', hotspot.icon ] }
										size="lg"
									/>
									<span>{ hotspot.icon }</span>
								</>
							) : (
								<span>{ __( 'Select Icon', 'godam' ) }</span>
							) }
						</Button>
					) }
					renderContent={ () => (
						<div
							style={ {
								width: '240px',
								padding: '8px',
								background: '#fff',
								border: '1px solid #ccc',
								borderRadius: '6px',
								boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
							} }
						>
							<TextControl
								placeholder={ __( 'Search icons…', 'godam' ) }
								value={ searchQuery }
								onChange={ ( val ) => setSearchQuery( val ) }
							/>

							<div
								className="icon-grid mt-2"
								style={ {
									display: 'flex',
									flexWrap: 'wrap',
									gap: '6px',
									maxHeight: '240px',
									overflowY: 'auto',
									marginTop: '8px',
								} }
							>
								{ filteredIcons.map( ( { iconName, prefix }, idx ) => {
									const isSelected = hotspot.icon === iconName;

									return (
										<button
											key={ `${ prefix }-${ iconName }-${ idx }` }
											type="button"
											onClick={ () => {
												updateField(
													'hotspots',
													hotspots.map( ( h2, j ) =>
														j === index
															? { ...h2, icon: iconName, customIconUrl: null, customIconId: null }
															: h2,
													),
												);
												setIsOpen( false ); // Close the dropdown
											} }
											style={ {
												border: isSelected
													? '2px solid #007cba'
													: '1px solid #ccc',
												borderRadius: '4px',
												padding: '8px',
												cursor: 'pointer',
												background: '#fff',
											} }
										>
											<FontAwesomeIcon
												icon={ [ prefix, iconName ] }
												size="lg"
											/>
										</button>
									);
								} ) }
							</div>
						</div>
					) }
				/>

				<Button
					variant="secondary"
					size="compact"
					onClick={ handleUploadCustomIcon }
					className="flex-shrink-0 flex items-center gap-2 godam-button px-3"
					disabled={ disabled }
				>
					{ hotspot.customIconUrl ? (
						<>
							<img
								src={ hotspot.customIconUrl }
								alt={ __( 'Custom Icon', 'godam' ) }
								style={ {
									width: '20px',
									height: '20px',
									objectFit: 'contain',
								} }
							/>
							<span>{ __( 'Custom Icon', 'godam' ) }</span>
						</>
					) : (
						<span>{ __( 'Custom Icon', 'godam' ) }</span>
					) }
				</Button>

				{ ( hotspot.icon || hotspot.customIconUrl ) && (
					<Button
						variant="secondary"
						size="compact"
						onClick={ handleReset }
						className="flex-shrink-0 godam-button"
						icon={ trash }
					>
					</Button>
				) }
			</div>
			{ notice.isVisible && (
				<Notice
					className="my-4"
					status={ notice.status }
					onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
				>
					{ notice.message }
				</Notice>
			) }
		</div>
	);
};

export default FontAwesomeIconPicker;
