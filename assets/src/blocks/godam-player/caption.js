/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from '@wordpress/element';
import { usePrevious } from '@wordpress/compose';
import { __ } from '@wordpress/i18n';
import {
	BlockControls,
} from '@wordpress/block-editor';
import { TextControl, ToolbarButton } from '@wordpress/components';
import { caption as captionIcon } from '@wordpress/icons';

/**
 * Renders a caption component for audio or video blocks, allowing users to
 * add, edit, or remove captions. The component can be controlled via a toolbar
 * button to toggle its visibility. It uses the WordPress block editor's
 * controls and components for rendering and managing state.
 *
 * @since 1.0.0
 * @param {Object}      props                                - The properties passed to the component.
 * @param {string}      [props.attributeKey='caption']       - The attribute key for storing the caption.
 * @param {Object}      props.attributes                     - The block's attributes.
 * @param {Function}    props.setAttributes                  - Function to update block attributes.
 * @param {boolean}     props.isSelected                     - Whether the block is currently selected.
 * @param {Function}    props.insertBlocksAfter              - Function to insert blocks after the current block.
 * @param {string}      [props.placeholder='Add caption']    - The placeholder text for the caption input.
 * @param {string}      [props.label='Caption text']         - The ARIA label for the caption input.
 * @param {boolean}     [props.showToolbarButton=true]       - Whether to show the toolbar button to toggle the caption.
 * @param {string}      [props.excludeElementClassName]      - Class name to exclude from the caption element.
 * @param {string}      [props.className]                    - Class name for the caption element.
 * @param {string}      [props.tagName='figcaption']         - The tag name for the caption element.
 * @param {string}      [props.addLabel='Add caption']       - Label for the "Add caption" button.
 * @param {string}      [props.removeLabel='Remove caption'] - Label for the "Remove caption" button.
 * @param {JSX.Element} [props.icon=captionIcon]             - Icon for the caption button.
 * @param {Object}      props.props                          - Additional props to be passed to the TextControl component.
 *
 * @return {JSX.Element} The rendered caption component.
 */
export function Caption( {
	attributeKey = 'caption',
	attributes,
	setAttributes,
	isSelected,
	insertBlocksAfter,
	placeholder = __( 'Add caption', 'godam' ),
	label = __( 'Caption text', 'godam' ),
	showToolbarButton = true,
	excludeElementClassName,
	className,
	tagName = 'figcaption',
	addLabel = __( 'Add caption', 'godam' ),
	removeLabel = __( 'Remove caption', 'godam' ),
	icon = captionIcon,
	...props
} ) {
	const caption = attributes[ attributeKey ];
	const prevCaption = usePrevious( caption );
	const isCaptionEmpty = caption === '';
	const isPrevCaptionEmpty = prevCaption === '';
	const [ showCaption, setShowCaption ] = useState( ! isCaptionEmpty );

	useEffect( () => {
		if ( ! isCaptionEmpty && isPrevCaptionEmpty ) {
			setShowCaption( true );
		}
	}, [ isCaptionEmpty, isPrevCaptionEmpty ] );

	useEffect( () => {
		if ( ! isSelected && isCaptionEmpty ) {
			setShowCaption( false );
		}
	}, [ isSelected, isCaptionEmpty ] );

	// Focus the caption when we click to add one.
	const ref = useCallback(
		( node ) => {
			if ( node && isCaptionEmpty ) {
				node.focus();
			}
		},
		[ isCaptionEmpty ],
	);

	return (
		<>
			{ showToolbarButton && (
				<BlockControls group="block">
					<ToolbarButton
						onClick={ () => {
							setShowCaption( ! showCaption );
							if ( showCaption && caption ) {
								setAttributes( {
									[ attributeKey ]: undefined,
								} );
							}
						} }
						icon={ icon }
						isPressed={ showCaption }
						label={ showCaption ? removeLabel : addLabel }
					/>
				</BlockControls>
			) }
			{ showCaption && (
				<TextControl
					identifier={ attributeKey }
					tagName={ tagName }
					className={ clsx(
						className,
						excludeElementClassName
							? ''
							: 'rtgodam-video-caption',
					) }
					ref={ ref }
					aria-label={ label }
					placeholder={ placeholder }
					value={ caption }
					onChange={ ( value ) => {
						setAttributes( { [ attributeKey ]: value } );
					} }
					{ ...props }
				/>
			) }
		</>
	);
}
