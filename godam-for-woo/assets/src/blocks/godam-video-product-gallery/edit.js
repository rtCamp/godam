/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @wordpress/no-unsafe-wp-apis */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	InspectorControls,
	InnerBlocks,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import {
	PanelBody,
	ToggleControl,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	__experimentalToggleGroupControlOptionIcon as ToggleGroupControlOptionIcon,
} from '@wordpress/components';
import { useEffect } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { columns, grid } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import './editor.scss';

/**
 * The edit function for GoDAM Video Product Gallery block.
 *
 * @param {Object}   props               Block props.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Function to set block attributes.
 * @param {string}   props.clientId      Block client ID.
 * @return {JSX.Element} Element to render.
 */
export default function Edit( { attributes, setAttributes, clientId } ) {
	const {
		blockId,
		layout,
		viewRatio,
		itemWidth,
		autoplay,
		showPlayButton,
		showAddToCart,
	} = attributes;

	// Read blockGap from native spacing support and convert preset values to CSS.
	const rawGap = attributes.style?.spacing?.blockGap;
	const gapCss = ( () => {
		if ( ! rawGap ) {
			return '16px';
		}
		if ( typeof rawGap === 'string' && rawGap.startsWith( 'var:preset|spacing|' ) ) {
			return rawGap.replace( 'var:preset|spacing|', 'var(--wp--preset--spacing--' ) + ')';
		}
		return rawGap;
	} )();

	// Set the Block id of the Block as ClientId.
	useEffect( () => {
		if ( ! blockId ) {
			setAttributes( { blockId: clientId } );
		}
	}, [ clientId, blockId, setAttributes ] );

	// Get inner blocks count
	const { hasInnerBlocks } = useSelect(
		( select ) => {
			const { getBlock } = select( blockEditorStore );
			const block = getBlock( clientId );
			return {
				hasInnerBlocks: !! ( block && block.innerBlocks.length ),
			};
		},
		[ clientId ],
	);

	const itemWidthMap = { S: 220, M: 260, L: 300 };
	const itemWidthPx = itemWidthMap[ itemWidth ] || itemWidthMap.M;

	const blockProps = useBlockProps( {
		className: `godam-video-product-gallery godam-video-product-gallery--${ layout }`,

		style: {
			'--godam-gallery-item-width': `${ itemWidthPx }px`,
			'--godam-gallery-gap': gapCss,
		},
	} );

	// Template for InnerBlocks - starts with one item
	const TEMPLATE = [ [ 'godam/video-product-gallery-item', {} ] ];

	// Allowed blocks - only gallery items
	const ALLOWED_BLOCKS = [ 'godam/video-product-gallery-item' ];

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Layout', 'godam-woo' ) } initialOpen={ true }>
					{ /* Layout Selector with Icons */ }
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Layout', 'godam-woo' ) }
						value={ layout }
						onChange={ ( value ) => setAttributes( { layout: value } ) }
					>
						<ToggleGroupControlOptionIcon
							icon={ columns }
							label={ __( 'Carousel', 'godam-woo' ) }
							value="carousel"
						/>
						<ToggleGroupControlOptionIcon
							icon={ grid }
							label={ __( 'Grid', 'godam-woo' ) }
							value="grid"
						/>
					</ToggleGroupControl>

					{ /* View Ratio Selector */ }
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'View Ratio', 'godam-woo' ) }
						value={ viewRatio }
						onChange={ ( value ) => setAttributes( { viewRatio: value } ) }
					>
						<ToggleGroupControlOption label="4:3" value="4:3" />
						<ToggleGroupControlOption label="9:16" value="9:16" />
						<ToggleGroupControlOption label="3:4" value="3:4" />
						<ToggleGroupControlOption label="1:1" value="1:1" />
						<ToggleGroupControlOption label="16:9" value="16:9" />
					</ToggleGroupControl>

					{ /* Item Width Selector */ }
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Item Size', 'godam-woo' ) }
						value={ itemWidth }
						onChange={ ( value ) => setAttributes( { itemWidth: value } ) }
						help={ __( 'Size of each gallery item.', 'godam-woo' ) }
					>
						<ToggleGroupControlOption label={ __( 'S', 'godam-woo' ) } value="S" />
						<ToggleGroupControlOption label={ __( 'M', 'godam-woo' ) } value="M" />
						<ToggleGroupControlOption label={ __( 'L', 'godam-woo' ) } value="L" />
					</ToggleGroupControl>
				</PanelBody>

				<PanelBody title={ __( 'Playback & Interaction', 'godam-woo' ) } initialOpen={ true }>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Autoplay', 'godam-woo' ) }
						help={
							autoplay
								? __( 'Visible videos autoplay one at a time and continue through the full video.', 'godam-woo' )
								: __( 'Videos only play when hovered.', 'godam-woo' )
						}
						checked={ !! autoplay }
						onChange={ ( value ) => setAttributes( { autoplay: value } ) }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show Play Button', 'godam-woo' ) }
						help={ __( 'Shows an overlay play button whenever a video is not playing.', 'godam-woo' ) }
						checked={ !! showPlayButton }
						onChange={ ( value ) => setAttributes( { showPlayButton: value } ) }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show Add to Cart Button', 'godam-woo' ) }
						help={
							showAddToCart
								? __( 'Displays an Add to Cart button on each product.', 'godam-woo' )
								: __( 'Add to Cart button is hidden. Clicking the product title opens the product page.', 'godam-woo' )
						}
						checked={ !! showAddToCart }
						onChange={ ( value ) => setAttributes( { showAddToCart: value } ) }
					/>
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				<InnerBlocks
					allowedBlocks={ ALLOWED_BLOCKS }
					template={ hasInnerBlocks ? undefined : TEMPLATE }
					orientation={ layout === 'carousel' ? 'horizontal' : 'vertical' }
					renderAppender={ InnerBlocks.ButtonBlockAppender }
				/>
			</div>
		</>
	);
}
