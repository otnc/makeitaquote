const axios = require('axios');
const displus = require('displus');
const { API_URL, BETA_API_URL } = require('./lib/config');

/**
 * @class MiQ
 * @description The MiQ class is designed to create a quote with customizable properties such as text, avatar, username, display name, color, and watermark. It also provides a method to generate a quote image or data from an external API.
 */
class MiQ {
  constructor() {
    this.format = {
      text: '',
      avatar: null,
      username: '',
      display_name: '',
      color: false,
      watermark: ''
    };
  }

  /**
   * @function setFromMessage
   * @description Sets the quote properties based on a Discord message object.
   * @param {Object} message - The Discord message object.
   * @param {boolean} [formatText=false] - Whether to format the text by removing markdown.
   * @returns {MiQ} Returns the instance of MiQ for chaining.
   */
  setFromMessage(message, formatText = false) {
    this.setText(message.content, formatText);
    this.setAvatar(message.member ? message.member.displayAvatarURL() : message.author.displayAvatarURL());
    this.setUsername((!message.author?.discriminator || message.author?.discriminator === '0') ? message.author.username : `${message.author.username}#${message.author.discriminator}`);
    this.setDisplayname(message.member ? message.member.displayName : (message.author?.global_name ?? message.author.username));
    return this;
  }

  /**
   * @function setFromObject
   * @description Sets the quote properties based on an object.
   * @param {Object} data - The object containing quote properties.
   * @param {boolean} [formatText=false] - Whether to format the text by removing markdown.
   * @returns {MiQ} Returns the instance of MiQ for chaining.
   */
  setFromObject(data, formatText = false) {
    if (data.text) this.setText(data.text, formatText);
    if (data.avatar) this.setAvatar(data.avatar);
    if (data.username) this.setUsername(data.username);
    if (data.display_name) this.setDisplayname(data.display_name);
    if (typeof data.color === 'boolean') this.setColor(data.color);
    if (data.watermark) this.setWatermark(data.watermark);
    return this;
  }

  /**
   * @function setText
   * @description Sets the text of the quote. Optionally formats the text to remove markdown.
   * @param {string} text - The text to be set.
   * @param {boolean} [formatText=false] - Whether to format the text by removing markdown.
   * @throws {TypeError} Throws an error if text is not a string or formatText is not a boolean.
   * @returns {MiQ} Returns the instance of MiQ for chaining.
   */
  setText(text, formatText = false) {
    let t = text;
    if (typeof text !== 'string') {
      throw new TypeError('Text must be string');
    }
    if (typeof formatText !== 'boolean') {
      throw new TypeError('formatText must be boolean');
    }
    if (formatText) t = displus.removeMarkdown(t);
    this.format.text = t;
    return this;
  }

  /**
   * @function setAvatar
   * @description Sets the avatar URL of the quote.
   * @param {string|null} avatar - The avatar URL to be set.
   * @throws {TypeError} Throws an error if avatar is not a string or null.
   * @returns {MiQ} Returns the instance of MiQ for chaining.
   */
  setAvatar(avatar) {
    if (avatar !== null && typeof avatar !== 'string') {
      throw new TypeError('Avatar must be string or null');
    }
    this.format.avatar = avatar;
    return this;
  }

  /**
   * @function setUsername
   * @description Sets the username of the quote.
   * @param {string} username - The username to be set.
   * @throws {TypeError} Throws an error if username is not a string.
   * @returns {MiQ} Returns the instance of MiQ for chaining.
   */
  setUsername(username) {
    if (typeof username !== 'string') {
      throw new TypeError('Username must be string');
    }
    this.format.username = username;
    return this;
  }

  /**
   * @function setDisplayname
   * @description Sets the display name of the quote.
   * @param {string} display_name - The display name to be set.
   * @throws {TypeError} Throws an error if display_name is not a string.
   * @returns {MiQ} Returns the instance of MiQ for chaining.
   */
  setDisplayname(display_name) {
    if (typeof display_name !== 'string') {
      throw new TypeError('Display name must be string');
    }
    this.format.display_name = display_name;
    return this;
  }

  /**
   * @function setColor
   * @description Sets whether the quote should have a colored background.
   * @param {boolean} [color=false] - Whether to use a colored background.
   * @throws {TypeError} Throws an error if color is not a boolean.
   * @returns {MiQ} Returns the instance of MiQ for chaining.
   */
  setColor(color = false) {
    if (typeof color !== 'boolean') {
      throw new TypeError('Color must be boolean');
    }
    this.format.color = color;
    return this;
  }

  /**
   * @function setWatermark
   * @description Sets the watermark text of the quote.
   * @param {string} watermark - The watermark text to be set.
   * @throws {TypeError} Throws an error if watermark is not a string.
   * @returns {MiQ} Returns the instance of MiQ for chaining.
   */
  setWatermark(watermark) {
    if (typeof watermark !== 'string') {
      throw new TypeError('Watermark must be string');
    }
    this.format.watermark = watermark;
    return this;
  }

  /**
   * @function generate
   * @description Generates the quote by sending a request to the external API.
   * @param {boolean} [returnRawImage=false] - Whether to return raw image instead of the URL.
   * @throws {Error} Throws an error if text is not set or if an API request fails.
   * @returns {Promise<string|Buffer>} Returns the URL of the generated quote or the raw data.
   */
  async generate(returnRawImage = false) {
    if (!this.format.text) {
      throw new Error('Text is required');
    }
    if (typeof returnRawImage !== 'boolean') {
      throw new TypeError('returnRawImage must be boolean');
    }

    try {
      if (returnRawImage) {
        const response = (await axios.post(API_URL, this.format)).data;
        const imageBuffer = await axios.get(response.url, { responseType: 'arraybuffer' });
        const image = Buffer.from(imageBuffer.data, 'binary');
        return image;
      } else {
        const response = await axios.post(API_URL, this.format, { responseType: 'json' });
        return response.data.url;
      }
    } catch (error) {
      if (error.response) {
        throw new Error(`Failed to generate quote: ${error.message}, Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        throw new Error(`Failed to generate quote: No response received, ${error.message}`);
      } else {
        throw new Error(`Failed to generate quote: ${error.message}`);
      }
    }
  }

  /**
   * @function generateBeta
   * @description Generates the quote by sending a request to the external API.
   * @throws {Error} Throws an error if text is not set or if an API request fails.
   * @returns {Promise<Buffer>} Returns the raw data.
   */
  async generateBeta() {
    if (!this.format.text) {
      throw new Error('Text is required');
    }

    try {
      const response = (await axios.post(BETA_API_URL, this.format, { responseType: 'arraybuffer' })).data;
      const image = Buffer.from(response);
      return image;
    } catch (error) {
      if (error.response) {
        throw new Error(`Failed to generate quote: ${error.message}, Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        throw new Error(`Failed to generate quote: No response received, ${error.message}`);
      } else {
        throw new Error(`Failed to generate quote: ${error.message}`);
      }
    }
  }

  /**
   * @function getFormat
   * @description Returns the current format settings of the quote.
   * @returns {Object} Returns the current format settings.
   */
  getFormat() {
    return this.format;
  }
}

module.exports = { MiQ };
