/**
 * This block will take the images and will convert them into a video.
 */

import { registerBlockType } from "@wordpress/blocks";

import edit from "./edit";
import save from "./save";
import metadata from "./block.json";

registerBlockType(metadata.name, {
    ...metadata,
    edit,
    save,
});
