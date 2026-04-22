/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable react-hooks/exhaustive-deps */
/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from '@wordpress/element';
import { ComboboxControl, Button } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { close } from '@wordpress/icons';

/**
 * Gray 1×1 pixel SVG used as an image fallback when no product image is available.
 * Avoids broken-image icons and external placeholder dependencies.
 */
const PLACEHOLDER_IMG =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%23e2e8f0'/%3E%3Cpath d='M16 14h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm0 0' fill='none' stroke='%23a0aec0' stroke-width='1.5'/%3E%3Ccircle cx='18' cy='18' r='1.5' fill='%23a0aec0'/%3E%3Cpath d='M14 26l4-4 2 2 3-3 3 3' fill='none' stroke='%23a0aec0' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E";

const ProductSelector = ( { index, value, productHotspot, productHotspots, updateField, isValidAPIKey } ) => {
	const [ products, setProducts ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( false );
	const [ searchTerm, setSearchTerm ] = useState( '' );

	const restURL = window.godamRestRoute?.url || '';

	const fetchProducts = useCallback(
		( term ) => {
			if ( ! isValidAPIKey || ! term ) {
				return;
			}

			setIsLoading( true );

			apiFetch( {
				url: `${ restURL }godam/v1/wcproducts?search=${ encodeURIComponent( term ) }`,
			} )
				.then( ( getProducts ) => {
					const formatted = getProducts.map( ( product ) => {
						// put EVERY searchable token in the label.
						const searchBlob = [
							product.name,
							product.id,
							...( product.categories ?? [] ).flatMap( ( t ) => [ t.name, t.slug ] ),
							...( product.tags ?? [] ).flatMap( ( t ) => [ t.name, t.slug ] ),
							...( product.brands ?? [] ).flatMap( ( t ) => [ t.name, t.slug ] ),
						].join( ' ' );

						return {
							label: searchBlob.toLowerCase(),
							value: String( product.id ),
							search: searchBlob.toLowerCase(),
							view: product.name,
							image: product.image || '',
							product,
						};
					} );
					setProducts( formatted );
				} )
				.catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.error( 'Error fetching products:', error );
				} )
				.finally( () => setIsLoading( false ) );
		},
		[ isValidAPIKey ],
	);

	useEffect( () => {
		if (
			isValidAPIKey &&
            value &&
            ! products.find( ( p ) => p.value === value )
		) {
			apiFetch( {
				url: `${ restURL }godam/v1/wcproduct?id=${ value }`,
			} )
				.then( ( product ) => {
					const searchBlob = [
						product.name,
						product.id,
						...( product.categories ?? [] ).flatMap( ( t ) => [ t.name, t.slug ] ),
						...( product.tags ?? [] ).flatMap( ( t ) => [ t.name, t.slug ] ),
						...( product.brands ?? [] ).flatMap( ( t ) => [ t.name, t.slug ] ),
					].join( ' ' ).toLowerCase();

					const option = {
						label: product.name,
						value: String( product.id ),
						search: searchBlob,
						view: product.name,
						image: product.image || '',
						product,
					};
					setProducts( ( prev ) => [ ...prev, option ] );
				} )
				.catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.error( 'Error fetching selected product details:', error );
				} );
		}
	}, [
		isValidAPIKey,
		value,
		products,
	] );

	useEffect( () => {
		const delayDebounce = setTimeout( () => {
			if ( searchTerm.length > 1 ) {
				fetchProducts( searchTerm );
			}
		}, 300 );

		return () => clearTimeout( delayDebounce );
	}, [ searchTerm, fetchProducts ] );

	// Get full product option by selected ID.
	const getOptionById = ( id ) => products.find( ( p ) => p.value === id );

	useEffect( () => {
		const input = document.querySelector(
			'.godam-combobox input.components-combobox-control__input',
		);
		if ( ! input ) {
			return;
		}

		const stopEnter = ( e ) => {
			if ( e.key === 'Enter' ) {
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
		};

		input.addEventListener( 'keydown', stopEnter );

		return () => input.removeEventListener( 'keydown', stopEnter );
	}, [] );

	// Resolve data for the currently-selected product.
	const selectedOption = value ? getOptionById( String( value ) ) : null;
	const selectedName = selectedOption?.view ?? ( value ? `#${ value }` : '' );
	const selectedImage = selectedOption?.image || '';

	// Clear the current product selection.
	const clearSelection = () => {
		updateField(
			'productHotspots',
			productHotspots.map( ( h2, j ) =>
				j === index ? { ...h2, productId: null } : h2,
			),
		);
	};

	return (
		<div className="godam-product-selector">

			{ /* ── Selected-product chip ── */ }
			{ value && (
				<div className="godam-product-selected-preview">
					<span className="godam-product-selected-label components-base-control__label">
						{ __( 'Select Product', 'godam-woo' ) }
					</span>
					<div className="godam-product-selected-chip">
						<img
							src={ selectedImage || PLACEHOLDER_IMG }
							alt={ selectedName }
							className="godam-product-selected-thumb"
							width="32"
							height="32"
							onError={ ( e ) => {
								e.currentTarget.src = PLACEHOLDER_IMG;
							} }
						/>
						<span className="godam-product-selected-name">{ selectedName }</span>
						<Button
							icon={ close }
							label={ __( 'Remove selected product', 'godam-woo' ) }
							className="godam-product-selected-remove"
							onClick={ clearSelection }
							disabled={ ! isValidAPIKey }
							isSmall
						/>
					</div>
				</div>
			) }

			{ /* ── Search combobox – shown only when nothing is selected ── */ }
			{ ! value && (
				<div className="godam-combobox">
					<ComboboxControl
						label={ __( 'Select Product', 'godam-woo' ) }
						placeholder={ __( 'Type in to find products…', 'godam-woo' ) }
						expandOnFocus={ false }
						help={ __( 'Start typing at least two characters to search products by product name, category, tag, brand or ID.', 'godam-woo' ) }
						value={ productHotspot.productId }
						options={ products }
						onChange={ ( val ) => {
							const foundOption = getOptionById( val );
							const fullProduct = foundOption?.product;
							if ( fullProduct ) {
								setProducts( ( prev ) =>
									prev.map( ( o ) =>
										o.value === val ? { ...o, label: fullProduct.name } : o,
									),
								);
								// Store product ID only – fresh data is always fetched from WooCommerce.
								updateField(
									'productHotspots',
									productHotspots.map( ( h2, j ) =>
										j === index
											? { ...h2, productId: val }
											: h2,
									),
								);
							}
						} }
						onFilterValueChange={ ( input ) => {
							setSearchTerm( input );
						} }
						isLoading={ isLoading }
						disabled={ ! isValidAPIKey }
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						__experimentalShowSuggestionsWhenFieldIsFocused={ true }
						__experimentalRenderItem={ ( { item } ) => (
							<span className="godam-product-option">
								<img
									src={ item.image || PLACEHOLDER_IMG }
									alt={ item.view }
									className="godam-product-option-thumb"
									width="32"
									height="32"
									onError={ ( e ) => {
										e.currentTarget.src = PLACEHOLDER_IMG;
									} }
								/>
								<span className="godam-product-option-name">{ item.view }</span>
							</span>
						) }
					/>
				</div>
			) }
		</div>
	);
};

export default ProductSelector;
