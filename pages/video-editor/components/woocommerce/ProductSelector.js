/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from '@wordpress/element';
import { ComboboxControl } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

const ProductSelector = ( { index, value, productHotspot, productHotspots, updateField, isValidAPIKey } ) => {
	const [ products, setProducts ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( false );
	const [ searchTerm, setSearchTerm ] = useState( '' );

	const fetchProducts = useCallback(
		( term ) => {
			if ( ! isValidAPIKey || ! term ) {
				return;
			}

			setIsLoading( true );

			apiFetch( {
				path: `/wp-json/godam/v1/wcproducts?search=${ encodeURIComponent( term ) }`,
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
				path: `/wp-json/godam/v1/wcproduct?id=${ value }`,
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

	// Get full product object by selected ID
	const getProductById = ( id ) => {
		return products.find( ( p ) => p.value === id )?.product;
	};

	return (
		<div className="godam-combobox">
			<ComboboxControl
				label={ __( 'Select Product', 'godam' ) }
				placeholder={ __( 'Type in to find products…', 'godam' ) }
				expandOnFocus={ false }
				help={ __( 'Start typing at least two characters to search products by product name, category, tag, brand or ID.', 'godam' ) }
				value={ productHotspot.productId }
				options={ products }
				onChange={ ( val ) => {
					const fullProduct = getProductById( val );
					if ( fullProduct ) {
						setProducts( ( prev ) =>
							prev.map( ( o ) =>
								o.value === val ? { ...o, label: fullProduct.name } : o,
							),
						);
						updateField(
							'productHotspots',
							productHotspots.map( ( h2, j ) =>
								j === index
									? {
										...h2,
										productId: val,
										productDetails: fullProduct,
									}
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
				__experimentalRenderItem={ ( { item } ) => item.view }
			/>
		</div>
	);
};

export default ProductSelector;
