/**
 * External dependencies
 */
import 'quill/dist/quill.snow.css';
import Quill from 'quill';
import { useEffect, useRef } from 'react';

const QuillEditor = ( { className, initialValue, onHTMLChange, toolbarOptions } ) => {
	const wrapperRef = useRef();

	useEffect( () => {
		if ( wrapperRef ) {
			const editor = document.createElement( 'div' );
			wrapperRef.current.appendChild( editor );

			const options = {
				theme: 'snow',
			};

			if ( toolbarOptions ) {
				options.modules = {
					toolbar: toolbarOptions ?? [],
				};
			}

			const quill = new Quill( editor, options );

			quill.clipboard.dangerouslyPasteHTML( initialValue || '' );

			quill.on( 'text-change', function( delta, oldDelta, source ) {
				if ( source === 'user' ) {
					onHTMLChange( quill.root.innerHTML );
				}
			} );

			quill.blur();
		}

		return () => {
			if ( wrapperRef.current ) {
				wrapperRef.current.innerHTML = '';
			}
		};
	}, [] );

	return (
		<div className={ className } ref={ wrapperRef } />
	);
};

export default QuillEditor;
