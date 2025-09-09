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
import { Dropdown, TextControl, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

// Add all free solid icons to the library
library.add( fas );

const FontAwesomeIconPicker = ( { productHotspot, disabled = false, index, productHotspots, updateField } ) => {
	const [ searchQuery, setSearchQuery ] = useState( '' );
	const [ isOpen, setIsOpen ] = useState( false ); // eslint-disable-line no-unused-vars

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
			'productHotspots',
			productHotspots.map( ( h2, j ) =>
				j === index ? { ...h2, icon: null } : h2,
			),
		);
	};

	return (
		<div className="flex flex-col gap-2 mt-3">
			<label
				htmlFor={ `hotspot-icon-${ index }` }
				className="text-xs text-gray-700"
			>
				{ __( 'PRODUCT HOTSPOT ICON', 'godam' ) }
			</label>

			<div className="flex items-center gap-2">
				<Dropdown
					renderToggle={ ( { isDropDownOpen, onToggle } ) => (
						<Button
							onClick={ onToggle }
							aria-expanded={ isDropDownOpen }
							variant="secondary"
							className="flex-grow flex items-center gap-2"
							disabled={ disabled }
						>
							{ productHotspot.icon ? (
								<>
									<FontAwesomeIcon
										icon={ [ 'fas', productHotspot.icon ] }
										size="lg"
									/>
									<span>{ productHotspot.icon }</span>
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
									const isSelected = productHotspot.icon === iconName;

									return (
										<button
											key={ `${ prefix }-${ iconName }-${ idx }` }
											type="button"
											onClick={ () => {
												updateField(
													'productHotspots',
													productHotspots.map( ( h2, j ) =>
														j === index
															? { ...h2, icon: iconName }
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

				{ productHotspot.icon && (
					<Button
						variant="secondary"
						onClick={ handleReset }
						className="flex-shrink-0"
					>
						{ __( 'Reset', 'godam' ) }
					</Button>
				) }
			</div>
		</div>
	);
};

export default FontAwesomeIconPicker;
