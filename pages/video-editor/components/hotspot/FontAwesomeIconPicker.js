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

/**
 * Icon picker for the hotspot layer's SHARED icon style.
 *
 * Matches the design's "Add Icon" area: when nothing is selected it shows two
 * dashed tiles — "Select from library" (a FontAwesome icon grid) and "Add
 * custom" (a WordPress media upload). Once an icon is chosen it collapses to a
 * bordered row with the icon preview, the same two change affordances, and a
 * trash button to clear it.
 *
 * Operates on a single icon value via `value`/`onChange` rather than mutating a
 * hotspot entry; the parent owns where it is stored (layer-level
 * `icon`/`customIconUrl`/`customIconId`). `onChange` receives
 * `{ icon, customIconUrl, customIconId }` with the two icon kinds mutually
 * exclusive.
 *
 * @param {Object}   props                 Props.
 * @param {string}   [props.icon]          Selected FontAwesome icon name.
 * @param {string}   [props.customIconUrl] Selected custom icon URL.
 * @param {number}   [props.customIconId]  Selected custom icon attachment id.
 * @param {Function} props.onChange        Receives `{ icon, customIconUrl, customIconId }`.
 * @param {boolean}  [props.disabled]      Whether the control is disabled.
 * @return {JSX.Element} The icon picker.
 */
const FontAwesomeIconPicker = ( { icon, customIconUrl, customIconId, onChange, disabled = false } ) => {
	const [ searchQuery, setSearchQuery ] = useState( '' );

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

	const hasSelection = !! ( icon || customIconUrl );

	const iconList = Object.values( fas )
		.map( ( faIcon ) => ( {
			iconName: faIcon.iconName,
			prefix: faIcon.prefix,
		} ) )
		.filter(
			( faIcon, idx, self ) =>
				idx ===
			self.findIndex( ( i ) => i.iconName === faIcon.iconName ),
		);

	// Filter icons by search query
	const filteredIcons = iconList.filter( ( faIcon ) =>
		faIcon.iconName.toLowerCase().includes( searchQuery.toLowerCase() ),
	);

	// Handle reset action
	const handleReset = () => {
		onChange( { icon: null, customIconUrl: null, customIconId: null } );
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
				showNotice( __( 'Only Image files are allowed', 'godam' ), 'error' );
				return;
			}

			// Clear any existing notice on successful upload
			setNotice( { message: '', status: 'success', isVisible: false } );

			// Set the custom icon and clear the FontAwesome icon.
			onChange( {
				customIconUrl: attachment.url,
				customIconId: attachment.id,
				icon: null,
			} );
		} );

		// If there's already a custom icon selected, pre-select it in the media library
		if ( customIconId ) {
			const attachment = wp.media.attachment( customIconId );
			attachment.fetch();

			fileFrame.on( 'open', function() {
				const selection = fileFrame.state().get( 'selection' );
				selection.reset();
				selection.add( attachment );
			} );
		}

		fileFrame.open();
	};

	// The FontAwesome icon grid, shared by the empty-state tile and the
	// selected-state "Select from library" button (both anchor a Dropdown).
	// Styled inline because the Dropdown renders into a popover portal that
	// sits OUTSIDE the `.godam-video-editor` scope, so scoped SCSS won't reach.
	const renderLibraryContent = ( { onClose } ) => (
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
				__nextHasNoMarginBottom
				placeholder={ __( 'Search icons…', 'godam' ) }
				value={ searchQuery }
				onChange={ ( val ) => setSearchQuery( val ) }
			/>

			<div
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
					const isSelected = icon === iconName;

					return (
						<button
							key={ `${ prefix }-${ iconName }-${ idx }` }
							type="button"
							aria-label={ iconName }
							onClick={ () => {
								onChange( { icon: iconName, customIconUrl: null, customIconId: null } );
								onClose();
							} }
							style={ {
								border: isSelected ? '2px solid #007cba' : '1px solid #ccc',
								borderRadius: '4px',
								padding: '8px',
								cursor: 'pointer',
								background: '#fff',
							} }
						>
							<FontAwesomeIcon icon={ [ prefix, iconName ] } size="lg" />
						</button>
					);
				} ) }
			</div>
		</div>
	);

	return (
		<div className="godam-ve-icon-picker">
			<span className="godam-ve-field__label">{ __( 'Add Icon', 'godam' ) }</span>

			{ hasSelection ? (
				<div className="godam-ve-icon-picker__selected">
					<span className="godam-ve-icon-picker__preview">
						{ icon ? (
							<FontAwesomeIcon icon={ [ 'fas', icon ] } size="lg" />
						) : (
							<img src={ customIconUrl } alt={ __( 'Custom Icon', 'godam' ) } />
						) }
					</span>

					<div className="godam-ve-icon-picker__change">
						<Dropdown
							className="godam-ve-icon-picker__library"
							popoverProps={ { placement: 'bottom-start' } }
							renderToggle={ ( { isOpen, onToggle } ) => (
								<Button
									variant="link"
									onClick={ onToggle }
									aria-expanded={ isOpen }
									disabled={ disabled }
								>
									{ __( 'Select from library', 'godam' ) }
								</Button>
							) }
							renderContent={ renderLibraryContent }
						/>
						<Button variant="link" onClick={ handleUploadCustomIcon } disabled={ disabled }>
							{ __( 'Add custom', 'godam' ) }
						</Button>
					</div>

					<Button
						className="godam-ve-icon-picker__remove"
						icon={ trash }
						label={ __( 'Remove icon', 'godam' ) }
						onClick={ handleReset }
						disabled={ disabled }
					/>
				</div>
			) : (
				<div className="godam-ve-icon-picker__tiles">
					<Dropdown
						className="godam-ve-icon-picker__library"
						popoverProps={ { placement: 'bottom-start' } }
						renderToggle={ ( { isOpen, onToggle } ) => (
							<button
								type="button"
								className="godam-ve-icon-picker__tile"
								aria-expanded={ isOpen }
								onClick={ onToggle }
								disabled={ disabled }
							>
								{ __( 'Select from library', 'godam' ) }
							</button>
						) }
						renderContent={ renderLibraryContent }
					/>
					<button
						type="button"
						className="godam-ve-icon-picker__tile"
						onClick={ handleUploadCustomIcon }
						disabled={ disabled }
					>
						{ __( 'Add custom', 'godam' ) }
					</button>
				</div>
			) }

			{ notice.isVisible && (
				<Notice
					className="godam-ve-icon-picker__notice"
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
