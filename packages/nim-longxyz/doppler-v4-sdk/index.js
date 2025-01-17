import {
  AbiEncodingLengthMismatchError,
  BaseError,
  BytesSizeMismatchError,
  InvalidAddressError,
  UnsupportedPackedAbiType,
  arrayRegex,
  boolToHex,
  bytesRegex,
  concatHex,
  encodeAbiParameters,
  etherUnits,
  getAddress,
  integerRegex,
  isAddress,
  keccak256,
  numberToHex,
  pad,
  stringToHex,
  toHex
} from "./chunk-JETJAMPN.js";
import {
  __commonJS,
  __require,
  __toESM
} from "./chunk-4VNS5WPM.js";

// ../../node_modules/bn.js/lib/bn.js
var require_bn = __commonJS({
  "../../node_modules/bn.js/lib/bn.js"(exports, module) {
    "use strict";
    (function(module2, exports2) {
      "use strict";
      function assert(val, msg) {
        if (!val) throw new Error(msg || "Assertion failed");
      }
      function inherits(ctor, superCtor) {
        ctor.super_ = superCtor;
        var TempCtor = function() {
        };
        TempCtor.prototype = superCtor.prototype;
        ctor.prototype = new TempCtor();
        ctor.prototype.constructor = ctor;
      }
      function BN2(number, base, endian) {
        if (BN2.isBN(number)) {
          return number;
        }
        this.negative = 0;
        this.words = null;
        this.length = 0;
        this.red = null;
        if (number !== null) {
          if (base === "le" || base === "be") {
            endian = base;
            base = 10;
          }
          this._init(number || 0, base || 10, endian || "be");
        }
      }
      if (typeof module2 === "object") {
        module2.exports = BN2;
      } else {
        exports2.BN = BN2;
      }
      BN2.BN = BN2;
      BN2.wordSize = 26;
      var Buffer;
      try {
        if (typeof window !== "undefined" && typeof window.Buffer !== "undefined") {
          Buffer = window.Buffer;
        } else {
          Buffer = __require("buffer").Buffer;
        }
      } catch (e) {
      }
      BN2.isBN = function isBN(num) {
        if (num instanceof BN2) {
          return true;
        }
        return num !== null && typeof num === "object" && num.constructor.wordSize === BN2.wordSize && Array.isArray(num.words);
      };
      BN2.max = function max(left, right) {
        if (left.cmp(right) > 0) return left;
        return right;
      };
      BN2.min = function min(left, right) {
        if (left.cmp(right) < 0) return left;
        return right;
      };
      BN2.prototype._init = function init(number, base, endian) {
        if (typeof number === "number") {
          return this._initNumber(number, base, endian);
        }
        if (typeof number === "object") {
          return this._initArray(number, base, endian);
        }
        if (base === "hex") {
          base = 16;
        }
        assert(base === (base | 0) && base >= 2 && base <= 36);
        number = number.toString().replace(/\s+/g, "");
        var start = 0;
        if (number[0] === "-") {
          start++;
          this.negative = 1;
        }
        if (start < number.length) {
          if (base === 16) {
            this._parseHex(number, start, endian);
          } else {
            this._parseBase(number, base, start);
            if (endian === "le") {
              this._initArray(this.toArray(), base, endian);
            }
          }
        }
      };
      BN2.prototype._initNumber = function _initNumber(number, base, endian) {
        if (number < 0) {
          this.negative = 1;
          number = -number;
        }
        if (number < 67108864) {
          this.words = [number & 67108863];
          this.length = 1;
        } else if (number < 4503599627370496) {
          this.words = [
            number & 67108863,
            number / 67108864 & 67108863
          ];
          this.length = 2;
        } else {
          assert(number < 9007199254740992);
          this.words = [
            number & 67108863,
            number / 67108864 & 67108863,
            1
          ];
          this.length = 3;
        }
        if (endian !== "le") return;
        this._initArray(this.toArray(), base, endian);
      };
      BN2.prototype._initArray = function _initArray(number, base, endian) {
        assert(typeof number.length === "number");
        if (number.length <= 0) {
          this.words = [0];
          this.length = 1;
          return this;
        }
        this.length = Math.ceil(number.length / 3);
        this.words = new Array(this.length);
        for (var i = 0; i < this.length; i++) {
          this.words[i] = 0;
        }
        var j, w;
        var off = 0;
        if (endian === "be") {
          for (i = number.length - 1, j = 0; i >= 0; i -= 3) {
            w = number[i] | number[i - 1] << 8 | number[i - 2] << 16;
            this.words[j] |= w << off & 67108863;
            this.words[j + 1] = w >>> 26 - off & 67108863;
            off += 24;
            if (off >= 26) {
              off -= 26;
              j++;
            }
          }
        } else if (endian === "le") {
          for (i = 0, j = 0; i < number.length; i += 3) {
            w = number[i] | number[i + 1] << 8 | number[i + 2] << 16;
            this.words[j] |= w << off & 67108863;
            this.words[j + 1] = w >>> 26 - off & 67108863;
            off += 24;
            if (off >= 26) {
              off -= 26;
              j++;
            }
          }
        }
        return this._strip();
      };
      function parseHex4Bits(string, index) {
        var c = string.charCodeAt(index);
        if (c >= 48 && c <= 57) {
          return c - 48;
        } else if (c >= 65 && c <= 70) {
          return c - 55;
        } else if (c >= 97 && c <= 102) {
          return c - 87;
        } else {
          assert(false, "Invalid character in " + string);
        }
      }
      function parseHexByte(string, lowerBound, index) {
        var r = parseHex4Bits(string, index);
        if (index - 1 >= lowerBound) {
          r |= parseHex4Bits(string, index - 1) << 4;
        }
        return r;
      }
      BN2.prototype._parseHex = function _parseHex(number, start, endian) {
        this.length = Math.ceil((number.length - start) / 6);
        this.words = new Array(this.length);
        for (var i = 0; i < this.length; i++) {
          this.words[i] = 0;
        }
        var off = 0;
        var j = 0;
        var w;
        if (endian === "be") {
          for (i = number.length - 1; i >= start; i -= 2) {
            w = parseHexByte(number, start, i) << off;
            this.words[j] |= w & 67108863;
            if (off >= 18) {
              off -= 18;
              j += 1;
              this.words[j] |= w >>> 26;
            } else {
              off += 8;
            }
          }
        } else {
          var parseLength = number.length - start;
          for (i = parseLength % 2 === 0 ? start + 1 : start; i < number.length; i += 2) {
            w = parseHexByte(number, start, i) << off;
            this.words[j] |= w & 67108863;
            if (off >= 18) {
              off -= 18;
              j += 1;
              this.words[j] |= w >>> 26;
            } else {
              off += 8;
            }
          }
        }
        this._strip();
      };
      function parseBase(str, start, end, mul) {
        var r = 0;
        var b = 0;
        var len = Math.min(str.length, end);
        for (var i = start; i < len; i++) {
          var c = str.charCodeAt(i) - 48;
          r *= mul;
          if (c >= 49) {
            b = c - 49 + 10;
          } else if (c >= 17) {
            b = c - 17 + 10;
          } else {
            b = c;
          }
          assert(c >= 0 && b < mul, "Invalid character");
          r += b;
        }
        return r;
      }
      BN2.prototype._parseBase = function _parseBase(number, base, start) {
        this.words = [0];
        this.length = 1;
        for (var limbLen = 0, limbPow = 1; limbPow <= 67108863; limbPow *= base) {
          limbLen++;
        }
        limbLen--;
        limbPow = limbPow / base | 0;
        var total = number.length - start;
        var mod = total % limbLen;
        var end = Math.min(total, total - mod) + start;
        var word = 0;
        for (var i = start; i < end; i += limbLen) {
          word = parseBase(number, i, i + limbLen, base);
          this.imuln(limbPow);
          if (this.words[0] + word < 67108864) {
            this.words[0] += word;
          } else {
            this._iaddn(word);
          }
        }
        if (mod !== 0) {
          var pow = 1;
          word = parseBase(number, i, number.length, base);
          for (i = 0; i < mod; i++) {
            pow *= base;
          }
          this.imuln(pow);
          if (this.words[0] + word < 67108864) {
            this.words[0] += word;
          } else {
            this._iaddn(word);
          }
        }
        this._strip();
      };
      BN2.prototype.copy = function copy(dest) {
        dest.words = new Array(this.length);
        for (var i = 0; i < this.length; i++) {
          dest.words[i] = this.words[i];
        }
        dest.length = this.length;
        dest.negative = this.negative;
        dest.red = this.red;
      };
      function move(dest, src) {
        dest.words = src.words;
        dest.length = src.length;
        dest.negative = src.negative;
        dest.red = src.red;
      }
      BN2.prototype._move = function _move(dest) {
        move(dest, this);
      };
      BN2.prototype.clone = function clone() {
        var r = new BN2(null);
        this.copy(r);
        return r;
      };
      BN2.prototype._expand = function _expand(size) {
        while (this.length < size) {
          this.words[this.length++] = 0;
        }
        return this;
      };
      BN2.prototype._strip = function strip() {
        while (this.length > 1 && this.words[this.length - 1] === 0) {
          this.length--;
        }
        return this._normSign();
      };
      BN2.prototype._normSign = function _normSign() {
        if (this.length === 1 && this.words[0] === 0) {
          this.negative = 0;
        }
        return this;
      };
      if (typeof Symbol !== "undefined" && typeof Symbol.for === "function") {
        try {
          BN2.prototype[Symbol.for("nodejs.util.inspect.custom")] = inspect;
        } catch (e) {
          BN2.prototype.inspect = inspect;
        }
      } else {
        BN2.prototype.inspect = inspect;
      }
      function inspect() {
        return (this.red ? "<BN-R: " : "<BN: ") + this.toString(16) + ">";
      }
      var zeros = [
        "",
        "0",
        "00",
        "000",
        "0000",
        "00000",
        "000000",
        "0000000",
        "00000000",
        "000000000",
        "0000000000",
        "00000000000",
        "000000000000",
        "0000000000000",
        "00000000000000",
        "000000000000000",
        "0000000000000000",
        "00000000000000000",
        "000000000000000000",
        "0000000000000000000",
        "00000000000000000000",
        "000000000000000000000",
        "0000000000000000000000",
        "00000000000000000000000",
        "000000000000000000000000",
        "0000000000000000000000000"
      ];
      var groupSizes = [
        0,
        0,
        25,
        16,
        12,
        11,
        10,
        9,
        8,
        8,
        7,
        7,
        7,
        7,
        6,
        6,
        6,
        6,
        6,
        6,
        6,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5
      ];
      var groupBases = [
        0,
        0,
        33554432,
        43046721,
        16777216,
        48828125,
        60466176,
        40353607,
        16777216,
        43046721,
        1e7,
        19487171,
        35831808,
        62748517,
        7529536,
        11390625,
        16777216,
        24137569,
        34012224,
        47045881,
        64e6,
        4084101,
        5153632,
        6436343,
        7962624,
        9765625,
        11881376,
        14348907,
        17210368,
        20511149,
        243e5,
        28629151,
        33554432,
        39135393,
        45435424,
        52521875,
        60466176
      ];
      BN2.prototype.toString = function toString(base, padding) {
        base = base || 10;
        padding = padding | 0 || 1;
        var out;
        if (base === 16 || base === "hex") {
          out = "";
          var off = 0;
          var carry = 0;
          for (var i = 0; i < this.length; i++) {
            var w = this.words[i];
            var word = ((w << off | carry) & 16777215).toString(16);
            carry = w >>> 24 - off & 16777215;
            off += 2;
            if (off >= 26) {
              off -= 26;
              i--;
            }
            if (carry !== 0 || i !== this.length - 1) {
              out = zeros[6 - word.length] + word + out;
            } else {
              out = word + out;
            }
          }
          if (carry !== 0) {
            out = carry.toString(16) + out;
          }
          while (out.length % padding !== 0) {
            out = "0" + out;
          }
          if (this.negative !== 0) {
            out = "-" + out;
          }
          return out;
        }
        if (base === (base | 0) && base >= 2 && base <= 36) {
          var groupSize = groupSizes[base];
          var groupBase = groupBases[base];
          out = "";
          var c = this.clone();
          c.negative = 0;
          while (!c.isZero()) {
            var r = c.modrn(groupBase).toString(base);
            c = c.idivn(groupBase);
            if (!c.isZero()) {
              out = zeros[groupSize - r.length] + r + out;
            } else {
              out = r + out;
            }
          }
          if (this.isZero()) {
            out = "0" + out;
          }
          while (out.length % padding !== 0) {
            out = "0" + out;
          }
          if (this.negative !== 0) {
            out = "-" + out;
          }
          return out;
        }
        assert(false, "Base should be between 2 and 36");
      };
      BN2.prototype.toNumber = function toNumber() {
        var ret = this.words[0];
        if (this.length === 2) {
          ret += this.words[1] * 67108864;
        } else if (this.length === 3 && this.words[2] === 1) {
          ret += 4503599627370496 + this.words[1] * 67108864;
        } else if (this.length > 2) {
          assert(false, "Number can only safely store up to 53 bits");
        }
        return this.negative !== 0 ? -ret : ret;
      };
      BN2.prototype.toJSON = function toJSON() {
        return this.toString(16, 2);
      };
      if (Buffer) {
        BN2.prototype.toBuffer = function toBuffer(endian, length) {
          return this.toArrayLike(Buffer, endian, length);
        };
      }
      BN2.prototype.toArray = function toArray(endian, length) {
        return this.toArrayLike(Array, endian, length);
      };
      var allocate = function allocate2(ArrayType, size) {
        if (ArrayType.allocUnsafe) {
          return ArrayType.allocUnsafe(size);
        }
        return new ArrayType(size);
      };
      BN2.prototype.toArrayLike = function toArrayLike(ArrayType, endian, length) {
        this._strip();
        var byteLength = this.byteLength();
        var reqLength = length || Math.max(1, byteLength);
        assert(byteLength <= reqLength, "byte array longer than desired length");
        assert(reqLength > 0, "Requested array length <= 0");
        var res = allocate(ArrayType, reqLength);
        var postfix = endian === "le" ? "LE" : "BE";
        this["_toArrayLike" + postfix](res, byteLength);
        return res;
      };
      BN2.prototype._toArrayLikeLE = function _toArrayLikeLE(res, byteLength) {
        var position = 0;
        var carry = 0;
        for (var i = 0, shift = 0; i < this.length; i++) {
          var word = this.words[i] << shift | carry;
          res[position++] = word & 255;
          if (position < res.length) {
            res[position++] = word >> 8 & 255;
          }
          if (position < res.length) {
            res[position++] = word >> 16 & 255;
          }
          if (shift === 6) {
            if (position < res.length) {
              res[position++] = word >> 24 & 255;
            }
            carry = 0;
            shift = 0;
          } else {
            carry = word >>> 24;
            shift += 2;
          }
        }
        if (position < res.length) {
          res[position++] = carry;
          while (position < res.length) {
            res[position++] = 0;
          }
        }
      };
      BN2.prototype._toArrayLikeBE = function _toArrayLikeBE(res, byteLength) {
        var position = res.length - 1;
        var carry = 0;
        for (var i = 0, shift = 0; i < this.length; i++) {
          var word = this.words[i] << shift | carry;
          res[position--] = word & 255;
          if (position >= 0) {
            res[position--] = word >> 8 & 255;
          }
          if (position >= 0) {
            res[position--] = word >> 16 & 255;
          }
          if (shift === 6) {
            if (position >= 0) {
              res[position--] = word >> 24 & 255;
            }
            carry = 0;
            shift = 0;
          } else {
            carry = word >>> 24;
            shift += 2;
          }
        }
        if (position >= 0) {
          res[position--] = carry;
          while (position >= 0) {
            res[position--] = 0;
          }
        }
      };
      if (Math.clz32) {
        BN2.prototype._countBits = function _countBits(w) {
          return 32 - Math.clz32(w);
        };
      } else {
        BN2.prototype._countBits = function _countBits(w) {
          var t = w;
          var r = 0;
          if (t >= 4096) {
            r += 13;
            t >>>= 13;
          }
          if (t >= 64) {
            r += 7;
            t >>>= 7;
          }
          if (t >= 8) {
            r += 4;
            t >>>= 4;
          }
          if (t >= 2) {
            r += 2;
            t >>>= 2;
          }
          return r + t;
        };
      }
      BN2.prototype._zeroBits = function _zeroBits(w) {
        if (w === 0) return 26;
        var t = w;
        var r = 0;
        if ((t & 8191) === 0) {
          r += 13;
          t >>>= 13;
        }
        if ((t & 127) === 0) {
          r += 7;
          t >>>= 7;
        }
        if ((t & 15) === 0) {
          r += 4;
          t >>>= 4;
        }
        if ((t & 3) === 0) {
          r += 2;
          t >>>= 2;
        }
        if ((t & 1) === 0) {
          r++;
        }
        return r;
      };
      BN2.prototype.bitLength = function bitLength() {
        var w = this.words[this.length - 1];
        var hi = this._countBits(w);
        return (this.length - 1) * 26 + hi;
      };
      function toBitArray(num) {
        var w = new Array(num.bitLength());
        for (var bit = 0; bit < w.length; bit++) {
          var off = bit / 26 | 0;
          var wbit = bit % 26;
          w[bit] = num.words[off] >>> wbit & 1;
        }
        return w;
      }
      BN2.prototype.zeroBits = function zeroBits() {
        if (this.isZero()) return 0;
        var r = 0;
        for (var i = 0; i < this.length; i++) {
          var b = this._zeroBits(this.words[i]);
          r += b;
          if (b !== 26) break;
        }
        return r;
      };
      BN2.prototype.byteLength = function byteLength() {
        return Math.ceil(this.bitLength() / 8);
      };
      BN2.prototype.toTwos = function toTwos(width) {
        if (this.negative !== 0) {
          return this.abs().inotn(width).iaddn(1);
        }
        return this.clone();
      };
      BN2.prototype.fromTwos = function fromTwos(width) {
        if (this.testn(width - 1)) {
          return this.notn(width).iaddn(1).ineg();
        }
        return this.clone();
      };
      BN2.prototype.isNeg = function isNeg() {
        return this.negative !== 0;
      };
      BN2.prototype.neg = function neg() {
        return this.clone().ineg();
      };
      BN2.prototype.ineg = function ineg() {
        if (!this.isZero()) {
          this.negative ^= 1;
        }
        return this;
      };
      BN2.prototype.iuor = function iuor(num) {
        while (this.length < num.length) {
          this.words[this.length++] = 0;
        }
        for (var i = 0; i < num.length; i++) {
          this.words[i] = this.words[i] | num.words[i];
        }
        return this._strip();
      };
      BN2.prototype.ior = function ior(num) {
        assert((this.negative | num.negative) === 0);
        return this.iuor(num);
      };
      BN2.prototype.or = function or(num) {
        if (this.length > num.length) return this.clone().ior(num);
        return num.clone().ior(this);
      };
      BN2.prototype.uor = function uor(num) {
        if (this.length > num.length) return this.clone().iuor(num);
        return num.clone().iuor(this);
      };
      BN2.prototype.iuand = function iuand(num) {
        var b;
        if (this.length > num.length) {
          b = num;
        } else {
          b = this;
        }
        for (var i = 0; i < b.length; i++) {
          this.words[i] = this.words[i] & num.words[i];
        }
        this.length = b.length;
        return this._strip();
      };
      BN2.prototype.iand = function iand(num) {
        assert((this.negative | num.negative) === 0);
        return this.iuand(num);
      };
      BN2.prototype.and = function and(num) {
        if (this.length > num.length) return this.clone().iand(num);
        return num.clone().iand(this);
      };
      BN2.prototype.uand = function uand(num) {
        if (this.length > num.length) return this.clone().iuand(num);
        return num.clone().iuand(this);
      };
      BN2.prototype.iuxor = function iuxor(num) {
        var a;
        var b;
        if (this.length > num.length) {
          a = this;
          b = num;
        } else {
          a = num;
          b = this;
        }
        for (var i = 0; i < b.length; i++) {
          this.words[i] = a.words[i] ^ b.words[i];
        }
        if (this !== a) {
          for (; i < a.length; i++) {
            this.words[i] = a.words[i];
          }
        }
        this.length = a.length;
        return this._strip();
      };
      BN2.prototype.ixor = function ixor(num) {
        assert((this.negative | num.negative) === 0);
        return this.iuxor(num);
      };
      BN2.prototype.xor = function xor(num) {
        if (this.length > num.length) return this.clone().ixor(num);
        return num.clone().ixor(this);
      };
      BN2.prototype.uxor = function uxor(num) {
        if (this.length > num.length) return this.clone().iuxor(num);
        return num.clone().iuxor(this);
      };
      BN2.prototype.inotn = function inotn(width) {
        assert(typeof width === "number" && width >= 0);
        var bytesNeeded = Math.ceil(width / 26) | 0;
        var bitsLeft = width % 26;
        this._expand(bytesNeeded);
        if (bitsLeft > 0) {
          bytesNeeded--;
        }
        for (var i = 0; i < bytesNeeded; i++) {
          this.words[i] = ~this.words[i] & 67108863;
        }
        if (bitsLeft > 0) {
          this.words[i] = ~this.words[i] & 67108863 >> 26 - bitsLeft;
        }
        return this._strip();
      };
      BN2.prototype.notn = function notn(width) {
        return this.clone().inotn(width);
      };
      BN2.prototype.setn = function setn(bit, val) {
        assert(typeof bit === "number" && bit >= 0);
        var off = bit / 26 | 0;
        var wbit = bit % 26;
        this._expand(off + 1);
        if (val) {
          this.words[off] = this.words[off] | 1 << wbit;
        } else {
          this.words[off] = this.words[off] & ~(1 << wbit);
        }
        return this._strip();
      };
      BN2.prototype.iadd = function iadd(num) {
        var r;
        if (this.negative !== 0 && num.negative === 0) {
          this.negative = 0;
          r = this.isub(num);
          this.negative ^= 1;
          return this._normSign();
        } else if (this.negative === 0 && num.negative !== 0) {
          num.negative = 0;
          r = this.isub(num);
          num.negative = 1;
          return r._normSign();
        }
        var a, b;
        if (this.length > num.length) {
          a = this;
          b = num;
        } else {
          a = num;
          b = this;
        }
        var carry = 0;
        for (var i = 0; i < b.length; i++) {
          r = (a.words[i] | 0) + (b.words[i] | 0) + carry;
          this.words[i] = r & 67108863;
          carry = r >>> 26;
        }
        for (; carry !== 0 && i < a.length; i++) {
          r = (a.words[i] | 0) + carry;
          this.words[i] = r & 67108863;
          carry = r >>> 26;
        }
        this.length = a.length;
        if (carry !== 0) {
          this.words[this.length] = carry;
          this.length++;
        } else if (a !== this) {
          for (; i < a.length; i++) {
            this.words[i] = a.words[i];
          }
        }
        return this;
      };
      BN2.prototype.add = function add(num) {
        var res;
        if (num.negative !== 0 && this.negative === 0) {
          num.negative = 0;
          res = this.sub(num);
          num.negative ^= 1;
          return res;
        } else if (num.negative === 0 && this.negative !== 0) {
          this.negative = 0;
          res = num.sub(this);
          this.negative = 1;
          return res;
        }
        if (this.length > num.length) return this.clone().iadd(num);
        return num.clone().iadd(this);
      };
      BN2.prototype.isub = function isub(num) {
        if (num.negative !== 0) {
          num.negative = 0;
          var r = this.iadd(num);
          num.negative = 1;
          return r._normSign();
        } else if (this.negative !== 0) {
          this.negative = 0;
          this.iadd(num);
          this.negative = 1;
          return this._normSign();
        }
        var cmp = this.cmp(num);
        if (cmp === 0) {
          this.negative = 0;
          this.length = 1;
          this.words[0] = 0;
          return this;
        }
        var a, b;
        if (cmp > 0) {
          a = this;
          b = num;
        } else {
          a = num;
          b = this;
        }
        var carry = 0;
        for (var i = 0; i < b.length; i++) {
          r = (a.words[i] | 0) - (b.words[i] | 0) + carry;
          carry = r >> 26;
          this.words[i] = r & 67108863;
        }
        for (; carry !== 0 && i < a.length; i++) {
          r = (a.words[i] | 0) + carry;
          carry = r >> 26;
          this.words[i] = r & 67108863;
        }
        if (carry === 0 && i < a.length && a !== this) {
          for (; i < a.length; i++) {
            this.words[i] = a.words[i];
          }
        }
        this.length = Math.max(this.length, i);
        if (a !== this) {
          this.negative = 1;
        }
        return this._strip();
      };
      BN2.prototype.sub = function sub(num) {
        return this.clone().isub(num);
      };
      function smallMulTo(self2, num, out) {
        out.negative = num.negative ^ self2.negative;
        var len = self2.length + num.length | 0;
        out.length = len;
        len = len - 1 | 0;
        var a = self2.words[0] | 0;
        var b = num.words[0] | 0;
        var r = a * b;
        var lo = r & 67108863;
        var carry = r / 67108864 | 0;
        out.words[0] = lo;
        for (var k = 1; k < len; k++) {
          var ncarry = carry >>> 26;
          var rword = carry & 67108863;
          var maxJ = Math.min(k, num.length - 1);
          for (var j = Math.max(0, k - self2.length + 1); j <= maxJ; j++) {
            var i = k - j | 0;
            a = self2.words[i] | 0;
            b = num.words[j] | 0;
            r = a * b + rword;
            ncarry += r / 67108864 | 0;
            rword = r & 67108863;
          }
          out.words[k] = rword | 0;
          carry = ncarry | 0;
        }
        if (carry !== 0) {
          out.words[k] = carry | 0;
        } else {
          out.length--;
        }
        return out._strip();
      }
      var comb10MulTo = function comb10MulTo2(self2, num, out) {
        var a = self2.words;
        var b = num.words;
        var o = out.words;
        var c = 0;
        var lo;
        var mid;
        var hi;
        var a0 = a[0] | 0;
        var al0 = a0 & 8191;
        var ah0 = a0 >>> 13;
        var a1 = a[1] | 0;
        var al1 = a1 & 8191;
        var ah1 = a1 >>> 13;
        var a2 = a[2] | 0;
        var al2 = a2 & 8191;
        var ah2 = a2 >>> 13;
        var a3 = a[3] | 0;
        var al3 = a3 & 8191;
        var ah3 = a3 >>> 13;
        var a4 = a[4] | 0;
        var al4 = a4 & 8191;
        var ah4 = a4 >>> 13;
        var a5 = a[5] | 0;
        var al5 = a5 & 8191;
        var ah5 = a5 >>> 13;
        var a6 = a[6] | 0;
        var al6 = a6 & 8191;
        var ah6 = a6 >>> 13;
        var a7 = a[7] | 0;
        var al7 = a7 & 8191;
        var ah7 = a7 >>> 13;
        var a8 = a[8] | 0;
        var al8 = a8 & 8191;
        var ah8 = a8 >>> 13;
        var a9 = a[9] | 0;
        var al9 = a9 & 8191;
        var ah9 = a9 >>> 13;
        var b0 = b[0] | 0;
        var bl0 = b0 & 8191;
        var bh0 = b0 >>> 13;
        var b1 = b[1] | 0;
        var bl1 = b1 & 8191;
        var bh1 = b1 >>> 13;
        var b2 = b[2] | 0;
        var bl2 = b2 & 8191;
        var bh2 = b2 >>> 13;
        var b3 = b[3] | 0;
        var bl3 = b3 & 8191;
        var bh3 = b3 >>> 13;
        var b4 = b[4] | 0;
        var bl4 = b4 & 8191;
        var bh4 = b4 >>> 13;
        var b5 = b[5] | 0;
        var bl5 = b5 & 8191;
        var bh5 = b5 >>> 13;
        var b6 = b[6] | 0;
        var bl6 = b6 & 8191;
        var bh6 = b6 >>> 13;
        var b7 = b[7] | 0;
        var bl7 = b7 & 8191;
        var bh7 = b7 >>> 13;
        var b8 = b[8] | 0;
        var bl8 = b8 & 8191;
        var bh8 = b8 >>> 13;
        var b9 = b[9] | 0;
        var bl9 = b9 & 8191;
        var bh9 = b9 >>> 13;
        out.negative = self2.negative ^ num.negative;
        out.length = 19;
        lo = Math.imul(al0, bl0);
        mid = Math.imul(al0, bh0);
        mid = mid + Math.imul(ah0, bl0) | 0;
        hi = Math.imul(ah0, bh0);
        var w0 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w0 >>> 26) | 0;
        w0 &= 67108863;
        lo = Math.imul(al1, bl0);
        mid = Math.imul(al1, bh0);
        mid = mid + Math.imul(ah1, bl0) | 0;
        hi = Math.imul(ah1, bh0);
        lo = lo + Math.imul(al0, bl1) | 0;
        mid = mid + Math.imul(al0, bh1) | 0;
        mid = mid + Math.imul(ah0, bl1) | 0;
        hi = hi + Math.imul(ah0, bh1) | 0;
        var w1 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w1 >>> 26) | 0;
        w1 &= 67108863;
        lo = Math.imul(al2, bl0);
        mid = Math.imul(al2, bh0);
        mid = mid + Math.imul(ah2, bl0) | 0;
        hi = Math.imul(ah2, bh0);
        lo = lo + Math.imul(al1, bl1) | 0;
        mid = mid + Math.imul(al1, bh1) | 0;
        mid = mid + Math.imul(ah1, bl1) | 0;
        hi = hi + Math.imul(ah1, bh1) | 0;
        lo = lo + Math.imul(al0, bl2) | 0;
        mid = mid + Math.imul(al0, bh2) | 0;
        mid = mid + Math.imul(ah0, bl2) | 0;
        hi = hi + Math.imul(ah0, bh2) | 0;
        var w2 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w2 >>> 26) | 0;
        w2 &= 67108863;
        lo = Math.imul(al3, bl0);
        mid = Math.imul(al3, bh0);
        mid = mid + Math.imul(ah3, bl0) | 0;
        hi = Math.imul(ah3, bh0);
        lo = lo + Math.imul(al2, bl1) | 0;
        mid = mid + Math.imul(al2, bh1) | 0;
        mid = mid + Math.imul(ah2, bl1) | 0;
        hi = hi + Math.imul(ah2, bh1) | 0;
        lo = lo + Math.imul(al1, bl2) | 0;
        mid = mid + Math.imul(al1, bh2) | 0;
        mid = mid + Math.imul(ah1, bl2) | 0;
        hi = hi + Math.imul(ah1, bh2) | 0;
        lo = lo + Math.imul(al0, bl3) | 0;
        mid = mid + Math.imul(al0, bh3) | 0;
        mid = mid + Math.imul(ah0, bl3) | 0;
        hi = hi + Math.imul(ah0, bh3) | 0;
        var w3 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w3 >>> 26) | 0;
        w3 &= 67108863;
        lo = Math.imul(al4, bl0);
        mid = Math.imul(al4, bh0);
        mid = mid + Math.imul(ah4, bl0) | 0;
        hi = Math.imul(ah4, bh0);
        lo = lo + Math.imul(al3, bl1) | 0;
        mid = mid + Math.imul(al3, bh1) | 0;
        mid = mid + Math.imul(ah3, bl1) | 0;
        hi = hi + Math.imul(ah3, bh1) | 0;
        lo = lo + Math.imul(al2, bl2) | 0;
        mid = mid + Math.imul(al2, bh2) | 0;
        mid = mid + Math.imul(ah2, bl2) | 0;
        hi = hi + Math.imul(ah2, bh2) | 0;
        lo = lo + Math.imul(al1, bl3) | 0;
        mid = mid + Math.imul(al1, bh3) | 0;
        mid = mid + Math.imul(ah1, bl3) | 0;
        hi = hi + Math.imul(ah1, bh3) | 0;
        lo = lo + Math.imul(al0, bl4) | 0;
        mid = mid + Math.imul(al0, bh4) | 0;
        mid = mid + Math.imul(ah0, bl4) | 0;
        hi = hi + Math.imul(ah0, bh4) | 0;
        var w4 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w4 >>> 26) | 0;
        w4 &= 67108863;
        lo = Math.imul(al5, bl0);
        mid = Math.imul(al5, bh0);
        mid = mid + Math.imul(ah5, bl0) | 0;
        hi = Math.imul(ah5, bh0);
        lo = lo + Math.imul(al4, bl1) | 0;
        mid = mid + Math.imul(al4, bh1) | 0;
        mid = mid + Math.imul(ah4, bl1) | 0;
        hi = hi + Math.imul(ah4, bh1) | 0;
        lo = lo + Math.imul(al3, bl2) | 0;
        mid = mid + Math.imul(al3, bh2) | 0;
        mid = mid + Math.imul(ah3, bl2) | 0;
        hi = hi + Math.imul(ah3, bh2) | 0;
        lo = lo + Math.imul(al2, bl3) | 0;
        mid = mid + Math.imul(al2, bh3) | 0;
        mid = mid + Math.imul(ah2, bl3) | 0;
        hi = hi + Math.imul(ah2, bh3) | 0;
        lo = lo + Math.imul(al1, bl4) | 0;
        mid = mid + Math.imul(al1, bh4) | 0;
        mid = mid + Math.imul(ah1, bl4) | 0;
        hi = hi + Math.imul(ah1, bh4) | 0;
        lo = lo + Math.imul(al0, bl5) | 0;
        mid = mid + Math.imul(al0, bh5) | 0;
        mid = mid + Math.imul(ah0, bl5) | 0;
        hi = hi + Math.imul(ah0, bh5) | 0;
        var w5 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w5 >>> 26) | 0;
        w5 &= 67108863;
        lo = Math.imul(al6, bl0);
        mid = Math.imul(al6, bh0);
        mid = mid + Math.imul(ah6, bl0) | 0;
        hi = Math.imul(ah6, bh0);
        lo = lo + Math.imul(al5, bl1) | 0;
        mid = mid + Math.imul(al5, bh1) | 0;
        mid = mid + Math.imul(ah5, bl1) | 0;
        hi = hi + Math.imul(ah5, bh1) | 0;
        lo = lo + Math.imul(al4, bl2) | 0;
        mid = mid + Math.imul(al4, bh2) | 0;
        mid = mid + Math.imul(ah4, bl2) | 0;
        hi = hi + Math.imul(ah4, bh2) | 0;
        lo = lo + Math.imul(al3, bl3) | 0;
        mid = mid + Math.imul(al3, bh3) | 0;
        mid = mid + Math.imul(ah3, bl3) | 0;
        hi = hi + Math.imul(ah3, bh3) | 0;
        lo = lo + Math.imul(al2, bl4) | 0;
        mid = mid + Math.imul(al2, bh4) | 0;
        mid = mid + Math.imul(ah2, bl4) | 0;
        hi = hi + Math.imul(ah2, bh4) | 0;
        lo = lo + Math.imul(al1, bl5) | 0;
        mid = mid + Math.imul(al1, bh5) | 0;
        mid = mid + Math.imul(ah1, bl5) | 0;
        hi = hi + Math.imul(ah1, bh5) | 0;
        lo = lo + Math.imul(al0, bl6) | 0;
        mid = mid + Math.imul(al0, bh6) | 0;
        mid = mid + Math.imul(ah0, bl6) | 0;
        hi = hi + Math.imul(ah0, bh6) | 0;
        var w6 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w6 >>> 26) | 0;
        w6 &= 67108863;
        lo = Math.imul(al7, bl0);
        mid = Math.imul(al7, bh0);
        mid = mid + Math.imul(ah7, bl0) | 0;
        hi = Math.imul(ah7, bh0);
        lo = lo + Math.imul(al6, bl1) | 0;
        mid = mid + Math.imul(al6, bh1) | 0;
        mid = mid + Math.imul(ah6, bl1) | 0;
        hi = hi + Math.imul(ah6, bh1) | 0;
        lo = lo + Math.imul(al5, bl2) | 0;
        mid = mid + Math.imul(al5, bh2) | 0;
        mid = mid + Math.imul(ah5, bl2) | 0;
        hi = hi + Math.imul(ah5, bh2) | 0;
        lo = lo + Math.imul(al4, bl3) | 0;
        mid = mid + Math.imul(al4, bh3) | 0;
        mid = mid + Math.imul(ah4, bl3) | 0;
        hi = hi + Math.imul(ah4, bh3) | 0;
        lo = lo + Math.imul(al3, bl4) | 0;
        mid = mid + Math.imul(al3, bh4) | 0;
        mid = mid + Math.imul(ah3, bl4) | 0;
        hi = hi + Math.imul(ah3, bh4) | 0;
        lo = lo + Math.imul(al2, bl5) | 0;
        mid = mid + Math.imul(al2, bh5) | 0;
        mid = mid + Math.imul(ah2, bl5) | 0;
        hi = hi + Math.imul(ah2, bh5) | 0;
        lo = lo + Math.imul(al1, bl6) | 0;
        mid = mid + Math.imul(al1, bh6) | 0;
        mid = mid + Math.imul(ah1, bl6) | 0;
        hi = hi + Math.imul(ah1, bh6) | 0;
        lo = lo + Math.imul(al0, bl7) | 0;
        mid = mid + Math.imul(al0, bh7) | 0;
        mid = mid + Math.imul(ah0, bl7) | 0;
        hi = hi + Math.imul(ah0, bh7) | 0;
        var w7 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w7 >>> 26) | 0;
        w7 &= 67108863;
        lo = Math.imul(al8, bl0);
        mid = Math.imul(al8, bh0);
        mid = mid + Math.imul(ah8, bl0) | 0;
        hi = Math.imul(ah8, bh0);
        lo = lo + Math.imul(al7, bl1) | 0;
        mid = mid + Math.imul(al7, bh1) | 0;
        mid = mid + Math.imul(ah7, bl1) | 0;
        hi = hi + Math.imul(ah7, bh1) | 0;
        lo = lo + Math.imul(al6, bl2) | 0;
        mid = mid + Math.imul(al6, bh2) | 0;
        mid = mid + Math.imul(ah6, bl2) | 0;
        hi = hi + Math.imul(ah6, bh2) | 0;
        lo = lo + Math.imul(al5, bl3) | 0;
        mid = mid + Math.imul(al5, bh3) | 0;
        mid = mid + Math.imul(ah5, bl3) | 0;
        hi = hi + Math.imul(ah5, bh3) | 0;
        lo = lo + Math.imul(al4, bl4) | 0;
        mid = mid + Math.imul(al4, bh4) | 0;
        mid = mid + Math.imul(ah4, bl4) | 0;
        hi = hi + Math.imul(ah4, bh4) | 0;
        lo = lo + Math.imul(al3, bl5) | 0;
        mid = mid + Math.imul(al3, bh5) | 0;
        mid = mid + Math.imul(ah3, bl5) | 0;
        hi = hi + Math.imul(ah3, bh5) | 0;
        lo = lo + Math.imul(al2, bl6) | 0;
        mid = mid + Math.imul(al2, bh6) | 0;
        mid = mid + Math.imul(ah2, bl6) | 0;
        hi = hi + Math.imul(ah2, bh6) | 0;
        lo = lo + Math.imul(al1, bl7) | 0;
        mid = mid + Math.imul(al1, bh7) | 0;
        mid = mid + Math.imul(ah1, bl7) | 0;
        hi = hi + Math.imul(ah1, bh7) | 0;
        lo = lo + Math.imul(al0, bl8) | 0;
        mid = mid + Math.imul(al0, bh8) | 0;
        mid = mid + Math.imul(ah0, bl8) | 0;
        hi = hi + Math.imul(ah0, bh8) | 0;
        var w8 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w8 >>> 26) | 0;
        w8 &= 67108863;
        lo = Math.imul(al9, bl0);
        mid = Math.imul(al9, bh0);
        mid = mid + Math.imul(ah9, bl0) | 0;
        hi = Math.imul(ah9, bh0);
        lo = lo + Math.imul(al8, bl1) | 0;
        mid = mid + Math.imul(al8, bh1) | 0;
        mid = mid + Math.imul(ah8, bl1) | 0;
        hi = hi + Math.imul(ah8, bh1) | 0;
        lo = lo + Math.imul(al7, bl2) | 0;
        mid = mid + Math.imul(al7, bh2) | 0;
        mid = mid + Math.imul(ah7, bl2) | 0;
        hi = hi + Math.imul(ah7, bh2) | 0;
        lo = lo + Math.imul(al6, bl3) | 0;
        mid = mid + Math.imul(al6, bh3) | 0;
        mid = mid + Math.imul(ah6, bl3) | 0;
        hi = hi + Math.imul(ah6, bh3) | 0;
        lo = lo + Math.imul(al5, bl4) | 0;
        mid = mid + Math.imul(al5, bh4) | 0;
        mid = mid + Math.imul(ah5, bl4) | 0;
        hi = hi + Math.imul(ah5, bh4) | 0;
        lo = lo + Math.imul(al4, bl5) | 0;
        mid = mid + Math.imul(al4, bh5) | 0;
        mid = mid + Math.imul(ah4, bl5) | 0;
        hi = hi + Math.imul(ah4, bh5) | 0;
        lo = lo + Math.imul(al3, bl6) | 0;
        mid = mid + Math.imul(al3, bh6) | 0;
        mid = mid + Math.imul(ah3, bl6) | 0;
        hi = hi + Math.imul(ah3, bh6) | 0;
        lo = lo + Math.imul(al2, bl7) | 0;
        mid = mid + Math.imul(al2, bh7) | 0;
        mid = mid + Math.imul(ah2, bl7) | 0;
        hi = hi + Math.imul(ah2, bh7) | 0;
        lo = lo + Math.imul(al1, bl8) | 0;
        mid = mid + Math.imul(al1, bh8) | 0;
        mid = mid + Math.imul(ah1, bl8) | 0;
        hi = hi + Math.imul(ah1, bh8) | 0;
        lo = lo + Math.imul(al0, bl9) | 0;
        mid = mid + Math.imul(al0, bh9) | 0;
        mid = mid + Math.imul(ah0, bl9) | 0;
        hi = hi + Math.imul(ah0, bh9) | 0;
        var w9 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w9 >>> 26) | 0;
        w9 &= 67108863;
        lo = Math.imul(al9, bl1);
        mid = Math.imul(al9, bh1);
        mid = mid + Math.imul(ah9, bl1) | 0;
        hi = Math.imul(ah9, bh1);
        lo = lo + Math.imul(al8, bl2) | 0;
        mid = mid + Math.imul(al8, bh2) | 0;
        mid = mid + Math.imul(ah8, bl2) | 0;
        hi = hi + Math.imul(ah8, bh2) | 0;
        lo = lo + Math.imul(al7, bl3) | 0;
        mid = mid + Math.imul(al7, bh3) | 0;
        mid = mid + Math.imul(ah7, bl3) | 0;
        hi = hi + Math.imul(ah7, bh3) | 0;
        lo = lo + Math.imul(al6, bl4) | 0;
        mid = mid + Math.imul(al6, bh4) | 0;
        mid = mid + Math.imul(ah6, bl4) | 0;
        hi = hi + Math.imul(ah6, bh4) | 0;
        lo = lo + Math.imul(al5, bl5) | 0;
        mid = mid + Math.imul(al5, bh5) | 0;
        mid = mid + Math.imul(ah5, bl5) | 0;
        hi = hi + Math.imul(ah5, bh5) | 0;
        lo = lo + Math.imul(al4, bl6) | 0;
        mid = mid + Math.imul(al4, bh6) | 0;
        mid = mid + Math.imul(ah4, bl6) | 0;
        hi = hi + Math.imul(ah4, bh6) | 0;
        lo = lo + Math.imul(al3, bl7) | 0;
        mid = mid + Math.imul(al3, bh7) | 0;
        mid = mid + Math.imul(ah3, bl7) | 0;
        hi = hi + Math.imul(ah3, bh7) | 0;
        lo = lo + Math.imul(al2, bl8) | 0;
        mid = mid + Math.imul(al2, bh8) | 0;
        mid = mid + Math.imul(ah2, bl8) | 0;
        hi = hi + Math.imul(ah2, bh8) | 0;
        lo = lo + Math.imul(al1, bl9) | 0;
        mid = mid + Math.imul(al1, bh9) | 0;
        mid = mid + Math.imul(ah1, bl9) | 0;
        hi = hi + Math.imul(ah1, bh9) | 0;
        var w10 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w10 >>> 26) | 0;
        w10 &= 67108863;
        lo = Math.imul(al9, bl2);
        mid = Math.imul(al9, bh2);
        mid = mid + Math.imul(ah9, bl2) | 0;
        hi = Math.imul(ah9, bh2);
        lo = lo + Math.imul(al8, bl3) | 0;
        mid = mid + Math.imul(al8, bh3) | 0;
        mid = mid + Math.imul(ah8, bl3) | 0;
        hi = hi + Math.imul(ah8, bh3) | 0;
        lo = lo + Math.imul(al7, bl4) | 0;
        mid = mid + Math.imul(al7, bh4) | 0;
        mid = mid + Math.imul(ah7, bl4) | 0;
        hi = hi + Math.imul(ah7, bh4) | 0;
        lo = lo + Math.imul(al6, bl5) | 0;
        mid = mid + Math.imul(al6, bh5) | 0;
        mid = mid + Math.imul(ah6, bl5) | 0;
        hi = hi + Math.imul(ah6, bh5) | 0;
        lo = lo + Math.imul(al5, bl6) | 0;
        mid = mid + Math.imul(al5, bh6) | 0;
        mid = mid + Math.imul(ah5, bl6) | 0;
        hi = hi + Math.imul(ah5, bh6) | 0;
        lo = lo + Math.imul(al4, bl7) | 0;
        mid = mid + Math.imul(al4, bh7) | 0;
        mid = mid + Math.imul(ah4, bl7) | 0;
        hi = hi + Math.imul(ah4, bh7) | 0;
        lo = lo + Math.imul(al3, bl8) | 0;
        mid = mid + Math.imul(al3, bh8) | 0;
        mid = mid + Math.imul(ah3, bl8) | 0;
        hi = hi + Math.imul(ah3, bh8) | 0;
        lo = lo + Math.imul(al2, bl9) | 0;
        mid = mid + Math.imul(al2, bh9) | 0;
        mid = mid + Math.imul(ah2, bl9) | 0;
        hi = hi + Math.imul(ah2, bh9) | 0;
        var w11 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w11 >>> 26) | 0;
        w11 &= 67108863;
        lo = Math.imul(al9, bl3);
        mid = Math.imul(al9, bh3);
        mid = mid + Math.imul(ah9, bl3) | 0;
        hi = Math.imul(ah9, bh3);
        lo = lo + Math.imul(al8, bl4) | 0;
        mid = mid + Math.imul(al8, bh4) | 0;
        mid = mid + Math.imul(ah8, bl4) | 0;
        hi = hi + Math.imul(ah8, bh4) | 0;
        lo = lo + Math.imul(al7, bl5) | 0;
        mid = mid + Math.imul(al7, bh5) | 0;
        mid = mid + Math.imul(ah7, bl5) | 0;
        hi = hi + Math.imul(ah7, bh5) | 0;
        lo = lo + Math.imul(al6, bl6) | 0;
        mid = mid + Math.imul(al6, bh6) | 0;
        mid = mid + Math.imul(ah6, bl6) | 0;
        hi = hi + Math.imul(ah6, bh6) | 0;
        lo = lo + Math.imul(al5, bl7) | 0;
        mid = mid + Math.imul(al5, bh7) | 0;
        mid = mid + Math.imul(ah5, bl7) | 0;
        hi = hi + Math.imul(ah5, bh7) | 0;
        lo = lo + Math.imul(al4, bl8) | 0;
        mid = mid + Math.imul(al4, bh8) | 0;
        mid = mid + Math.imul(ah4, bl8) | 0;
        hi = hi + Math.imul(ah4, bh8) | 0;
        lo = lo + Math.imul(al3, bl9) | 0;
        mid = mid + Math.imul(al3, bh9) | 0;
        mid = mid + Math.imul(ah3, bl9) | 0;
        hi = hi + Math.imul(ah3, bh9) | 0;
        var w12 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w12 >>> 26) | 0;
        w12 &= 67108863;
        lo = Math.imul(al9, bl4);
        mid = Math.imul(al9, bh4);
        mid = mid + Math.imul(ah9, bl4) | 0;
        hi = Math.imul(ah9, bh4);
        lo = lo + Math.imul(al8, bl5) | 0;
        mid = mid + Math.imul(al8, bh5) | 0;
        mid = mid + Math.imul(ah8, bl5) | 0;
        hi = hi + Math.imul(ah8, bh5) | 0;
        lo = lo + Math.imul(al7, bl6) | 0;
        mid = mid + Math.imul(al7, bh6) | 0;
        mid = mid + Math.imul(ah7, bl6) | 0;
        hi = hi + Math.imul(ah7, bh6) | 0;
        lo = lo + Math.imul(al6, bl7) | 0;
        mid = mid + Math.imul(al6, bh7) | 0;
        mid = mid + Math.imul(ah6, bl7) | 0;
        hi = hi + Math.imul(ah6, bh7) | 0;
        lo = lo + Math.imul(al5, bl8) | 0;
        mid = mid + Math.imul(al5, bh8) | 0;
        mid = mid + Math.imul(ah5, bl8) | 0;
        hi = hi + Math.imul(ah5, bh8) | 0;
        lo = lo + Math.imul(al4, bl9) | 0;
        mid = mid + Math.imul(al4, bh9) | 0;
        mid = mid + Math.imul(ah4, bl9) | 0;
        hi = hi + Math.imul(ah4, bh9) | 0;
        var w13 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w13 >>> 26) | 0;
        w13 &= 67108863;
        lo = Math.imul(al9, bl5);
        mid = Math.imul(al9, bh5);
        mid = mid + Math.imul(ah9, bl5) | 0;
        hi = Math.imul(ah9, bh5);
        lo = lo + Math.imul(al8, bl6) | 0;
        mid = mid + Math.imul(al8, bh6) | 0;
        mid = mid + Math.imul(ah8, bl6) | 0;
        hi = hi + Math.imul(ah8, bh6) | 0;
        lo = lo + Math.imul(al7, bl7) | 0;
        mid = mid + Math.imul(al7, bh7) | 0;
        mid = mid + Math.imul(ah7, bl7) | 0;
        hi = hi + Math.imul(ah7, bh7) | 0;
        lo = lo + Math.imul(al6, bl8) | 0;
        mid = mid + Math.imul(al6, bh8) | 0;
        mid = mid + Math.imul(ah6, bl8) | 0;
        hi = hi + Math.imul(ah6, bh8) | 0;
        lo = lo + Math.imul(al5, bl9) | 0;
        mid = mid + Math.imul(al5, bh9) | 0;
        mid = mid + Math.imul(ah5, bl9) | 0;
        hi = hi + Math.imul(ah5, bh9) | 0;
        var w14 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w14 >>> 26) | 0;
        w14 &= 67108863;
        lo = Math.imul(al9, bl6);
        mid = Math.imul(al9, bh6);
        mid = mid + Math.imul(ah9, bl6) | 0;
        hi = Math.imul(ah9, bh6);
        lo = lo + Math.imul(al8, bl7) | 0;
        mid = mid + Math.imul(al8, bh7) | 0;
        mid = mid + Math.imul(ah8, bl7) | 0;
        hi = hi + Math.imul(ah8, bh7) | 0;
        lo = lo + Math.imul(al7, bl8) | 0;
        mid = mid + Math.imul(al7, bh8) | 0;
        mid = mid + Math.imul(ah7, bl8) | 0;
        hi = hi + Math.imul(ah7, bh8) | 0;
        lo = lo + Math.imul(al6, bl9) | 0;
        mid = mid + Math.imul(al6, bh9) | 0;
        mid = mid + Math.imul(ah6, bl9) | 0;
        hi = hi + Math.imul(ah6, bh9) | 0;
        var w15 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w15 >>> 26) | 0;
        w15 &= 67108863;
        lo = Math.imul(al9, bl7);
        mid = Math.imul(al9, bh7);
        mid = mid + Math.imul(ah9, bl7) | 0;
        hi = Math.imul(ah9, bh7);
        lo = lo + Math.imul(al8, bl8) | 0;
        mid = mid + Math.imul(al8, bh8) | 0;
        mid = mid + Math.imul(ah8, bl8) | 0;
        hi = hi + Math.imul(ah8, bh8) | 0;
        lo = lo + Math.imul(al7, bl9) | 0;
        mid = mid + Math.imul(al7, bh9) | 0;
        mid = mid + Math.imul(ah7, bl9) | 0;
        hi = hi + Math.imul(ah7, bh9) | 0;
        var w16 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w16 >>> 26) | 0;
        w16 &= 67108863;
        lo = Math.imul(al9, bl8);
        mid = Math.imul(al9, bh8);
        mid = mid + Math.imul(ah9, bl8) | 0;
        hi = Math.imul(ah9, bh8);
        lo = lo + Math.imul(al8, bl9) | 0;
        mid = mid + Math.imul(al8, bh9) | 0;
        mid = mid + Math.imul(ah8, bl9) | 0;
        hi = hi + Math.imul(ah8, bh9) | 0;
        var w17 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w17 >>> 26) | 0;
        w17 &= 67108863;
        lo = Math.imul(al9, bl9);
        mid = Math.imul(al9, bh9);
        mid = mid + Math.imul(ah9, bl9) | 0;
        hi = Math.imul(ah9, bh9);
        var w18 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w18 >>> 26) | 0;
        w18 &= 67108863;
        o[0] = w0;
        o[1] = w1;
        o[2] = w2;
        o[3] = w3;
        o[4] = w4;
        o[5] = w5;
        o[6] = w6;
        o[7] = w7;
        o[8] = w8;
        o[9] = w9;
        o[10] = w10;
        o[11] = w11;
        o[12] = w12;
        o[13] = w13;
        o[14] = w14;
        o[15] = w15;
        o[16] = w16;
        o[17] = w17;
        o[18] = w18;
        if (c !== 0) {
          o[19] = c;
          out.length++;
        }
        return out;
      };
      if (!Math.imul) {
        comb10MulTo = smallMulTo;
      }
      function bigMulTo(self2, num, out) {
        out.negative = num.negative ^ self2.negative;
        out.length = self2.length + num.length;
        var carry = 0;
        var hncarry = 0;
        for (var k = 0; k < out.length - 1; k++) {
          var ncarry = hncarry;
          hncarry = 0;
          var rword = carry & 67108863;
          var maxJ = Math.min(k, num.length - 1);
          for (var j = Math.max(0, k - self2.length + 1); j <= maxJ; j++) {
            var i = k - j;
            var a = self2.words[i] | 0;
            var b = num.words[j] | 0;
            var r = a * b;
            var lo = r & 67108863;
            ncarry = ncarry + (r / 67108864 | 0) | 0;
            lo = lo + rword | 0;
            rword = lo & 67108863;
            ncarry = ncarry + (lo >>> 26) | 0;
            hncarry += ncarry >>> 26;
            ncarry &= 67108863;
          }
          out.words[k] = rword;
          carry = ncarry;
          ncarry = hncarry;
        }
        if (carry !== 0) {
          out.words[k] = carry;
        } else {
          out.length--;
        }
        return out._strip();
      }
      function jumboMulTo(self2, num, out) {
        return bigMulTo(self2, num, out);
      }
      BN2.prototype.mulTo = function mulTo(num, out) {
        var res;
        var len = this.length + num.length;
        if (this.length === 10 && num.length === 10) {
          res = comb10MulTo(this, num, out);
        } else if (len < 63) {
          res = smallMulTo(this, num, out);
        } else if (len < 1024) {
          res = bigMulTo(this, num, out);
        } else {
          res = jumboMulTo(this, num, out);
        }
        return res;
      };
      function FFTM(x, y) {
        this.x = x;
        this.y = y;
      }
      FFTM.prototype.makeRBT = function makeRBT(N) {
        var t = new Array(N);
        var l = BN2.prototype._countBits(N) - 1;
        for (var i = 0; i < N; i++) {
          t[i] = this.revBin(i, l, N);
        }
        return t;
      };
      FFTM.prototype.revBin = function revBin(x, l, N) {
        if (x === 0 || x === N - 1) return x;
        var rb = 0;
        for (var i = 0; i < l; i++) {
          rb |= (x & 1) << l - i - 1;
          x >>= 1;
        }
        return rb;
      };
      FFTM.prototype.permute = function permute(rbt, rws, iws, rtws, itws, N) {
        for (var i = 0; i < N; i++) {
          rtws[i] = rws[rbt[i]];
          itws[i] = iws[rbt[i]];
        }
      };
      FFTM.prototype.transform = function transform(rws, iws, rtws, itws, N, rbt) {
        this.permute(rbt, rws, iws, rtws, itws, N);
        for (var s = 1; s < N; s <<= 1) {
          var l = s << 1;
          var rtwdf = Math.cos(2 * Math.PI / l);
          var itwdf = Math.sin(2 * Math.PI / l);
          for (var p = 0; p < N; p += l) {
            var rtwdf_ = rtwdf;
            var itwdf_ = itwdf;
            for (var j = 0; j < s; j++) {
              var re = rtws[p + j];
              var ie = itws[p + j];
              var ro = rtws[p + j + s];
              var io = itws[p + j + s];
              var rx = rtwdf_ * ro - itwdf_ * io;
              io = rtwdf_ * io + itwdf_ * ro;
              ro = rx;
              rtws[p + j] = re + ro;
              itws[p + j] = ie + io;
              rtws[p + j + s] = re - ro;
              itws[p + j + s] = ie - io;
              if (j !== l) {
                rx = rtwdf * rtwdf_ - itwdf * itwdf_;
                itwdf_ = rtwdf * itwdf_ + itwdf * rtwdf_;
                rtwdf_ = rx;
              }
            }
          }
        }
      };
      FFTM.prototype.guessLen13b = function guessLen13b(n, m) {
        var N = Math.max(m, n) | 1;
        var odd = N & 1;
        var i = 0;
        for (N = N / 2 | 0; N; N = N >>> 1) {
          i++;
        }
        return 1 << i + 1 + odd;
      };
      FFTM.prototype.conjugate = function conjugate(rws, iws, N) {
        if (N <= 1) return;
        for (var i = 0; i < N / 2; i++) {
          var t = rws[i];
          rws[i] = rws[N - i - 1];
          rws[N - i - 1] = t;
          t = iws[i];
          iws[i] = -iws[N - i - 1];
          iws[N - i - 1] = -t;
        }
      };
      FFTM.prototype.normalize13b = function normalize13b(ws, N) {
        var carry = 0;
        for (var i = 0; i < N / 2; i++) {
          var w = Math.round(ws[2 * i + 1] / N) * 8192 + Math.round(ws[2 * i] / N) + carry;
          ws[i] = w & 67108863;
          if (w < 67108864) {
            carry = 0;
          } else {
            carry = w / 67108864 | 0;
          }
        }
        return ws;
      };
      FFTM.prototype.convert13b = function convert13b(ws, len, rws, N) {
        var carry = 0;
        for (var i = 0; i < len; i++) {
          carry = carry + (ws[i] | 0);
          rws[2 * i] = carry & 8191;
          carry = carry >>> 13;
          rws[2 * i + 1] = carry & 8191;
          carry = carry >>> 13;
        }
        for (i = 2 * len; i < N; ++i) {
          rws[i] = 0;
        }
        assert(carry === 0);
        assert((carry & ~8191) === 0);
      };
      FFTM.prototype.stub = function stub(N) {
        var ph = new Array(N);
        for (var i = 0; i < N; i++) {
          ph[i] = 0;
        }
        return ph;
      };
      FFTM.prototype.mulp = function mulp(x, y, out) {
        var N = 2 * this.guessLen13b(x.length, y.length);
        var rbt = this.makeRBT(N);
        var _ = this.stub(N);
        var rws = new Array(N);
        var rwst = new Array(N);
        var iwst = new Array(N);
        var nrws = new Array(N);
        var nrwst = new Array(N);
        var niwst = new Array(N);
        var rmws = out.words;
        rmws.length = N;
        this.convert13b(x.words, x.length, rws, N);
        this.convert13b(y.words, y.length, nrws, N);
        this.transform(rws, _, rwst, iwst, N, rbt);
        this.transform(nrws, _, nrwst, niwst, N, rbt);
        for (var i = 0; i < N; i++) {
          var rx = rwst[i] * nrwst[i] - iwst[i] * niwst[i];
          iwst[i] = rwst[i] * niwst[i] + iwst[i] * nrwst[i];
          rwst[i] = rx;
        }
        this.conjugate(rwst, iwst, N);
        this.transform(rwst, iwst, rmws, _, N, rbt);
        this.conjugate(rmws, _, N);
        this.normalize13b(rmws, N);
        out.negative = x.negative ^ y.negative;
        out.length = x.length + y.length;
        return out._strip();
      };
      BN2.prototype.mul = function mul(num) {
        var out = new BN2(null);
        out.words = new Array(this.length + num.length);
        return this.mulTo(num, out);
      };
      BN2.prototype.mulf = function mulf(num) {
        var out = new BN2(null);
        out.words = new Array(this.length + num.length);
        return jumboMulTo(this, num, out);
      };
      BN2.prototype.imul = function imul(num) {
        return this.clone().mulTo(num, this);
      };
      BN2.prototype.imuln = function imuln(num) {
        var isNegNum = num < 0;
        if (isNegNum) num = -num;
        assert(typeof num === "number");
        assert(num < 67108864);
        var carry = 0;
        for (var i = 0; i < this.length; i++) {
          var w = (this.words[i] | 0) * num;
          var lo = (w & 67108863) + (carry & 67108863);
          carry >>= 26;
          carry += w / 67108864 | 0;
          carry += lo >>> 26;
          this.words[i] = lo & 67108863;
        }
        if (carry !== 0) {
          this.words[i] = carry;
          this.length++;
        }
        return isNegNum ? this.ineg() : this;
      };
      BN2.prototype.muln = function muln(num) {
        return this.clone().imuln(num);
      };
      BN2.prototype.sqr = function sqr() {
        return this.mul(this);
      };
      BN2.prototype.isqr = function isqr() {
        return this.imul(this.clone());
      };
      BN2.prototype.pow = function pow(num) {
        var w = toBitArray(num);
        if (w.length === 0) return new BN2(1);
        var res = this;
        for (var i = 0; i < w.length; i++, res = res.sqr()) {
          if (w[i] !== 0) break;
        }
        if (++i < w.length) {
          for (var q = res.sqr(); i < w.length; i++, q = q.sqr()) {
            if (w[i] === 0) continue;
            res = res.mul(q);
          }
        }
        return res;
      };
      BN2.prototype.iushln = function iushln(bits) {
        assert(typeof bits === "number" && bits >= 0);
        var r = bits % 26;
        var s = (bits - r) / 26;
        var carryMask = 67108863 >>> 26 - r << 26 - r;
        var i;
        if (r !== 0) {
          var carry = 0;
          for (i = 0; i < this.length; i++) {
            var newCarry = this.words[i] & carryMask;
            var c = (this.words[i] | 0) - newCarry << r;
            this.words[i] = c | carry;
            carry = newCarry >>> 26 - r;
          }
          if (carry) {
            this.words[i] = carry;
            this.length++;
          }
        }
        if (s !== 0) {
          for (i = this.length - 1; i >= 0; i--) {
            this.words[i + s] = this.words[i];
          }
          for (i = 0; i < s; i++) {
            this.words[i] = 0;
          }
          this.length += s;
        }
        return this._strip();
      };
      BN2.prototype.ishln = function ishln(bits) {
        assert(this.negative === 0);
        return this.iushln(bits);
      };
      BN2.prototype.iushrn = function iushrn(bits, hint, extended) {
        assert(typeof bits === "number" && bits >= 0);
        var h;
        if (hint) {
          h = (hint - hint % 26) / 26;
        } else {
          h = 0;
        }
        var r = bits % 26;
        var s = Math.min((bits - r) / 26, this.length);
        var mask = 67108863 ^ 67108863 >>> r << r;
        var maskedWords = extended;
        h -= s;
        h = Math.max(0, h);
        if (maskedWords) {
          for (var i = 0; i < s; i++) {
            maskedWords.words[i] = this.words[i];
          }
          maskedWords.length = s;
        }
        if (s === 0) {
        } else if (this.length > s) {
          this.length -= s;
          for (i = 0; i < this.length; i++) {
            this.words[i] = this.words[i + s];
          }
        } else {
          this.words[0] = 0;
          this.length = 1;
        }
        var carry = 0;
        for (i = this.length - 1; i >= 0 && (carry !== 0 || i >= h); i--) {
          var word = this.words[i] | 0;
          this.words[i] = carry << 26 - r | word >>> r;
          carry = word & mask;
        }
        if (maskedWords && carry !== 0) {
          maskedWords.words[maskedWords.length++] = carry;
        }
        if (this.length === 0) {
          this.words[0] = 0;
          this.length = 1;
        }
        return this._strip();
      };
      BN2.prototype.ishrn = function ishrn(bits, hint, extended) {
        assert(this.negative === 0);
        return this.iushrn(bits, hint, extended);
      };
      BN2.prototype.shln = function shln(bits) {
        return this.clone().ishln(bits);
      };
      BN2.prototype.ushln = function ushln(bits) {
        return this.clone().iushln(bits);
      };
      BN2.prototype.shrn = function shrn(bits) {
        return this.clone().ishrn(bits);
      };
      BN2.prototype.ushrn = function ushrn(bits) {
        return this.clone().iushrn(bits);
      };
      BN2.prototype.testn = function testn(bit) {
        assert(typeof bit === "number" && bit >= 0);
        var r = bit % 26;
        var s = (bit - r) / 26;
        var q = 1 << r;
        if (this.length <= s) return false;
        var w = this.words[s];
        return !!(w & q);
      };
      BN2.prototype.imaskn = function imaskn(bits) {
        assert(typeof bits === "number" && bits >= 0);
        var r = bits % 26;
        var s = (bits - r) / 26;
        assert(this.negative === 0, "imaskn works only with positive numbers");
        if (this.length <= s) {
          return this;
        }
        if (r !== 0) {
          s++;
        }
        this.length = Math.min(s, this.length);
        if (r !== 0) {
          var mask = 67108863 ^ 67108863 >>> r << r;
          this.words[this.length - 1] &= mask;
        }
        return this._strip();
      };
      BN2.prototype.maskn = function maskn(bits) {
        return this.clone().imaskn(bits);
      };
      BN2.prototype.iaddn = function iaddn(num) {
        assert(typeof num === "number");
        assert(num < 67108864);
        if (num < 0) return this.isubn(-num);
        if (this.negative !== 0) {
          if (this.length === 1 && (this.words[0] | 0) <= num) {
            this.words[0] = num - (this.words[0] | 0);
            this.negative = 0;
            return this;
          }
          this.negative = 0;
          this.isubn(num);
          this.negative = 1;
          return this;
        }
        return this._iaddn(num);
      };
      BN2.prototype._iaddn = function _iaddn(num) {
        this.words[0] += num;
        for (var i = 0; i < this.length && this.words[i] >= 67108864; i++) {
          this.words[i] -= 67108864;
          if (i === this.length - 1) {
            this.words[i + 1] = 1;
          } else {
            this.words[i + 1]++;
          }
        }
        this.length = Math.max(this.length, i + 1);
        return this;
      };
      BN2.prototype.isubn = function isubn(num) {
        assert(typeof num === "number");
        assert(num < 67108864);
        if (num < 0) return this.iaddn(-num);
        if (this.negative !== 0) {
          this.negative = 0;
          this.iaddn(num);
          this.negative = 1;
          return this;
        }
        this.words[0] -= num;
        if (this.length === 1 && this.words[0] < 0) {
          this.words[0] = -this.words[0];
          this.negative = 1;
        } else {
          for (var i = 0; i < this.length && this.words[i] < 0; i++) {
            this.words[i] += 67108864;
            this.words[i + 1] -= 1;
          }
        }
        return this._strip();
      };
      BN2.prototype.addn = function addn(num) {
        return this.clone().iaddn(num);
      };
      BN2.prototype.subn = function subn(num) {
        return this.clone().isubn(num);
      };
      BN2.prototype.iabs = function iabs() {
        this.negative = 0;
        return this;
      };
      BN2.prototype.abs = function abs() {
        return this.clone().iabs();
      };
      BN2.prototype._ishlnsubmul = function _ishlnsubmul(num, mul, shift) {
        var len = num.length + shift;
        var i;
        this._expand(len);
        var w;
        var carry = 0;
        for (i = 0; i < num.length; i++) {
          w = (this.words[i + shift] | 0) + carry;
          var right = (num.words[i] | 0) * mul;
          w -= right & 67108863;
          carry = (w >> 26) - (right / 67108864 | 0);
          this.words[i + shift] = w & 67108863;
        }
        for (; i < this.length - shift; i++) {
          w = (this.words[i + shift] | 0) + carry;
          carry = w >> 26;
          this.words[i + shift] = w & 67108863;
        }
        if (carry === 0) return this._strip();
        assert(carry === -1);
        carry = 0;
        for (i = 0; i < this.length; i++) {
          w = -(this.words[i] | 0) + carry;
          carry = w >> 26;
          this.words[i] = w & 67108863;
        }
        this.negative = 1;
        return this._strip();
      };
      BN2.prototype._wordDiv = function _wordDiv(num, mode) {
        var shift = this.length - num.length;
        var a = this.clone();
        var b = num;
        var bhi = b.words[b.length - 1] | 0;
        var bhiBits = this._countBits(bhi);
        shift = 26 - bhiBits;
        if (shift !== 0) {
          b = b.ushln(shift);
          a.iushln(shift);
          bhi = b.words[b.length - 1] | 0;
        }
        var m = a.length - b.length;
        var q;
        if (mode !== "mod") {
          q = new BN2(null);
          q.length = m + 1;
          q.words = new Array(q.length);
          for (var i = 0; i < q.length; i++) {
            q.words[i] = 0;
          }
        }
        var diff = a.clone()._ishlnsubmul(b, 1, m);
        if (diff.negative === 0) {
          a = diff;
          if (q) {
            q.words[m] = 1;
          }
        }
        for (var j = m - 1; j >= 0; j--) {
          var qj = (a.words[b.length + j] | 0) * 67108864 + (a.words[b.length + j - 1] | 0);
          qj = Math.min(qj / bhi | 0, 67108863);
          a._ishlnsubmul(b, qj, j);
          while (a.negative !== 0) {
            qj--;
            a.negative = 0;
            a._ishlnsubmul(b, 1, j);
            if (!a.isZero()) {
              a.negative ^= 1;
            }
          }
          if (q) {
            q.words[j] = qj;
          }
        }
        if (q) {
          q._strip();
        }
        a._strip();
        if (mode !== "div" && shift !== 0) {
          a.iushrn(shift);
        }
        return {
          div: q || null,
          mod: a
        };
      };
      BN2.prototype.divmod = function divmod(num, mode, positive) {
        assert(!num.isZero());
        if (this.isZero()) {
          return {
            div: new BN2(0),
            mod: new BN2(0)
          };
        }
        var div, mod, res;
        if (this.negative !== 0 && num.negative === 0) {
          res = this.neg().divmod(num, mode);
          if (mode !== "mod") {
            div = res.div.neg();
          }
          if (mode !== "div") {
            mod = res.mod.neg();
            if (positive && mod.negative !== 0) {
              mod.iadd(num);
            }
          }
          return {
            div,
            mod
          };
        }
        if (this.negative === 0 && num.negative !== 0) {
          res = this.divmod(num.neg(), mode);
          if (mode !== "mod") {
            div = res.div.neg();
          }
          return {
            div,
            mod: res.mod
          };
        }
        if ((this.negative & num.negative) !== 0) {
          res = this.neg().divmod(num.neg(), mode);
          if (mode !== "div") {
            mod = res.mod.neg();
            if (positive && mod.negative !== 0) {
              mod.isub(num);
            }
          }
          return {
            div: res.div,
            mod
          };
        }
        if (num.length > this.length || this.cmp(num) < 0) {
          return {
            div: new BN2(0),
            mod: this
          };
        }
        if (num.length === 1) {
          if (mode === "div") {
            return {
              div: this.divn(num.words[0]),
              mod: null
            };
          }
          if (mode === "mod") {
            return {
              div: null,
              mod: new BN2(this.modrn(num.words[0]))
            };
          }
          return {
            div: this.divn(num.words[0]),
            mod: new BN2(this.modrn(num.words[0]))
          };
        }
        return this._wordDiv(num, mode);
      };
      BN2.prototype.div = function div(num) {
        return this.divmod(num, "div", false).div;
      };
      BN2.prototype.mod = function mod(num) {
        return this.divmod(num, "mod", false).mod;
      };
      BN2.prototype.umod = function umod(num) {
        return this.divmod(num, "mod", true).mod;
      };
      BN2.prototype.divRound = function divRound(num) {
        var dm = this.divmod(num);
        if (dm.mod.isZero()) return dm.div;
        var mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;
        var half = num.ushrn(1);
        var r2 = num.andln(1);
        var cmp = mod.cmp(half);
        if (cmp < 0 || r2 === 1 && cmp === 0) return dm.div;
        return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
      };
      BN2.prototype.modrn = function modrn(num) {
        var isNegNum = num < 0;
        if (isNegNum) num = -num;
        assert(num <= 67108863);
        var p = (1 << 26) % num;
        var acc = 0;
        for (var i = this.length - 1; i >= 0; i--) {
          acc = (p * acc + (this.words[i] | 0)) % num;
        }
        return isNegNum ? -acc : acc;
      };
      BN2.prototype.modn = function modn(num) {
        return this.modrn(num);
      };
      BN2.prototype.idivn = function idivn(num) {
        var isNegNum = num < 0;
        if (isNegNum) num = -num;
        assert(num <= 67108863);
        var carry = 0;
        for (var i = this.length - 1; i >= 0; i--) {
          var w = (this.words[i] | 0) + carry * 67108864;
          this.words[i] = w / num | 0;
          carry = w % num;
        }
        this._strip();
        return isNegNum ? this.ineg() : this;
      };
      BN2.prototype.divn = function divn(num) {
        return this.clone().idivn(num);
      };
      BN2.prototype.egcd = function egcd(p) {
        assert(p.negative === 0);
        assert(!p.isZero());
        var x = this;
        var y = p.clone();
        if (x.negative !== 0) {
          x = x.umod(p);
        } else {
          x = x.clone();
        }
        var A = new BN2(1);
        var B = new BN2(0);
        var C = new BN2(0);
        var D = new BN2(1);
        var g = 0;
        while (x.isEven() && y.isEven()) {
          x.iushrn(1);
          y.iushrn(1);
          ++g;
        }
        var yp = y.clone();
        var xp = x.clone();
        while (!x.isZero()) {
          for (var i = 0, im = 1; (x.words[0] & im) === 0 && i < 26; ++i, im <<= 1) ;
          if (i > 0) {
            x.iushrn(i);
            while (i-- > 0) {
              if (A.isOdd() || B.isOdd()) {
                A.iadd(yp);
                B.isub(xp);
              }
              A.iushrn(1);
              B.iushrn(1);
            }
          }
          for (var j = 0, jm = 1; (y.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1) ;
          if (j > 0) {
            y.iushrn(j);
            while (j-- > 0) {
              if (C.isOdd() || D.isOdd()) {
                C.iadd(yp);
                D.isub(xp);
              }
              C.iushrn(1);
              D.iushrn(1);
            }
          }
          if (x.cmp(y) >= 0) {
            x.isub(y);
            A.isub(C);
            B.isub(D);
          } else {
            y.isub(x);
            C.isub(A);
            D.isub(B);
          }
        }
        return {
          a: C,
          b: D,
          gcd: y.iushln(g)
        };
      };
      BN2.prototype._invmp = function _invmp(p) {
        assert(p.negative === 0);
        assert(!p.isZero());
        var a = this;
        var b = p.clone();
        if (a.negative !== 0) {
          a = a.umod(p);
        } else {
          a = a.clone();
        }
        var x1 = new BN2(1);
        var x2 = new BN2(0);
        var delta = b.clone();
        while (a.cmpn(1) > 0 && b.cmpn(1) > 0) {
          for (var i = 0, im = 1; (a.words[0] & im) === 0 && i < 26; ++i, im <<= 1) ;
          if (i > 0) {
            a.iushrn(i);
            while (i-- > 0) {
              if (x1.isOdd()) {
                x1.iadd(delta);
              }
              x1.iushrn(1);
            }
          }
          for (var j = 0, jm = 1; (b.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1) ;
          if (j > 0) {
            b.iushrn(j);
            while (j-- > 0) {
              if (x2.isOdd()) {
                x2.iadd(delta);
              }
              x2.iushrn(1);
            }
          }
          if (a.cmp(b) >= 0) {
            a.isub(b);
            x1.isub(x2);
          } else {
            b.isub(a);
            x2.isub(x1);
          }
        }
        var res;
        if (a.cmpn(1) === 0) {
          res = x1;
        } else {
          res = x2;
        }
        if (res.cmpn(0) < 0) {
          res.iadd(p);
        }
        return res;
      };
      BN2.prototype.gcd = function gcd(num) {
        if (this.isZero()) return num.abs();
        if (num.isZero()) return this.abs();
        var a = this.clone();
        var b = num.clone();
        a.negative = 0;
        b.negative = 0;
        for (var shift = 0; a.isEven() && b.isEven(); shift++) {
          a.iushrn(1);
          b.iushrn(1);
        }
        do {
          while (a.isEven()) {
            a.iushrn(1);
          }
          while (b.isEven()) {
            b.iushrn(1);
          }
          var r = a.cmp(b);
          if (r < 0) {
            var t = a;
            a = b;
            b = t;
          } else if (r === 0 || b.cmpn(1) === 0) {
            break;
          }
          a.isub(b);
        } while (true);
        return b.iushln(shift);
      };
      BN2.prototype.invm = function invm(num) {
        return this.egcd(num).a.umod(num);
      };
      BN2.prototype.isEven = function isEven() {
        return (this.words[0] & 1) === 0;
      };
      BN2.prototype.isOdd = function isOdd() {
        return (this.words[0] & 1) === 1;
      };
      BN2.prototype.andln = function andln(num) {
        return this.words[0] & num;
      };
      BN2.prototype.bincn = function bincn(bit) {
        assert(typeof bit === "number");
        var r = bit % 26;
        var s = (bit - r) / 26;
        var q = 1 << r;
        if (this.length <= s) {
          this._expand(s + 1);
          this.words[s] |= q;
          return this;
        }
        var carry = q;
        for (var i = s; carry !== 0 && i < this.length; i++) {
          var w = this.words[i] | 0;
          w += carry;
          carry = w >>> 26;
          w &= 67108863;
          this.words[i] = w;
        }
        if (carry !== 0) {
          this.words[i] = carry;
          this.length++;
        }
        return this;
      };
      BN2.prototype.isZero = function isZero() {
        return this.length === 1 && this.words[0] === 0;
      };
      BN2.prototype.cmpn = function cmpn(num) {
        var negative = num < 0;
        if (this.negative !== 0 && !negative) return -1;
        if (this.negative === 0 && negative) return 1;
        this._strip();
        var res;
        if (this.length > 1) {
          res = 1;
        } else {
          if (negative) {
            num = -num;
          }
          assert(num <= 67108863, "Number is too big");
          var w = this.words[0] | 0;
          res = w === num ? 0 : w < num ? -1 : 1;
        }
        if (this.negative !== 0) return -res | 0;
        return res;
      };
      BN2.prototype.cmp = function cmp(num) {
        if (this.negative !== 0 && num.negative === 0) return -1;
        if (this.negative === 0 && num.negative !== 0) return 1;
        var res = this.ucmp(num);
        if (this.negative !== 0) return -res | 0;
        return res;
      };
      BN2.prototype.ucmp = function ucmp(num) {
        if (this.length > num.length) return 1;
        if (this.length < num.length) return -1;
        var res = 0;
        for (var i = this.length - 1; i >= 0; i--) {
          var a = this.words[i] | 0;
          var b = num.words[i] | 0;
          if (a === b) continue;
          if (a < b) {
            res = -1;
          } else if (a > b) {
            res = 1;
          }
          break;
        }
        return res;
      };
      BN2.prototype.gtn = function gtn(num) {
        return this.cmpn(num) === 1;
      };
      BN2.prototype.gt = function gt(num) {
        return this.cmp(num) === 1;
      };
      BN2.prototype.gten = function gten(num) {
        return this.cmpn(num) >= 0;
      };
      BN2.prototype.gte = function gte(num) {
        return this.cmp(num) >= 0;
      };
      BN2.prototype.ltn = function ltn(num) {
        return this.cmpn(num) === -1;
      };
      BN2.prototype.lt = function lt(num) {
        return this.cmp(num) === -1;
      };
      BN2.prototype.lten = function lten(num) {
        return this.cmpn(num) <= 0;
      };
      BN2.prototype.lte = function lte(num) {
        return this.cmp(num) <= 0;
      };
      BN2.prototype.eqn = function eqn(num) {
        return this.cmpn(num) === 0;
      };
      BN2.prototype.eq = function eq(num) {
        return this.cmp(num) === 0;
      };
      BN2.red = function red(num) {
        return new Red(num);
      };
      BN2.prototype.toRed = function toRed(ctx) {
        assert(!this.red, "Already a number in reduction context");
        assert(this.negative === 0, "red works only with positives");
        return ctx.convertTo(this)._forceRed(ctx);
      };
      BN2.prototype.fromRed = function fromRed() {
        assert(this.red, "fromRed works only with numbers in reduction context");
        return this.red.convertFrom(this);
      };
      BN2.prototype._forceRed = function _forceRed(ctx) {
        this.red = ctx;
        return this;
      };
      BN2.prototype.forceRed = function forceRed(ctx) {
        assert(!this.red, "Already a number in reduction context");
        return this._forceRed(ctx);
      };
      BN2.prototype.redAdd = function redAdd(num) {
        assert(this.red, "redAdd works only with red numbers");
        return this.red.add(this, num);
      };
      BN2.prototype.redIAdd = function redIAdd(num) {
        assert(this.red, "redIAdd works only with red numbers");
        return this.red.iadd(this, num);
      };
      BN2.prototype.redSub = function redSub(num) {
        assert(this.red, "redSub works only with red numbers");
        return this.red.sub(this, num);
      };
      BN2.prototype.redISub = function redISub(num) {
        assert(this.red, "redISub works only with red numbers");
        return this.red.isub(this, num);
      };
      BN2.prototype.redShl = function redShl(num) {
        assert(this.red, "redShl works only with red numbers");
        return this.red.shl(this, num);
      };
      BN2.prototype.redMul = function redMul(num) {
        assert(this.red, "redMul works only with red numbers");
        this.red._verify2(this, num);
        return this.red.mul(this, num);
      };
      BN2.prototype.redIMul = function redIMul(num) {
        assert(this.red, "redMul works only with red numbers");
        this.red._verify2(this, num);
        return this.red.imul(this, num);
      };
      BN2.prototype.redSqr = function redSqr() {
        assert(this.red, "redSqr works only with red numbers");
        this.red._verify1(this);
        return this.red.sqr(this);
      };
      BN2.prototype.redISqr = function redISqr() {
        assert(this.red, "redISqr works only with red numbers");
        this.red._verify1(this);
        return this.red.isqr(this);
      };
      BN2.prototype.redSqrt = function redSqrt() {
        assert(this.red, "redSqrt works only with red numbers");
        this.red._verify1(this);
        return this.red.sqrt(this);
      };
      BN2.prototype.redInvm = function redInvm() {
        assert(this.red, "redInvm works only with red numbers");
        this.red._verify1(this);
        return this.red.invm(this);
      };
      BN2.prototype.redNeg = function redNeg() {
        assert(this.red, "redNeg works only with red numbers");
        this.red._verify1(this);
        return this.red.neg(this);
      };
      BN2.prototype.redPow = function redPow(num) {
        assert(this.red && !num.red, "redPow(normalNum)");
        this.red._verify1(this);
        return this.red.pow(this, num);
      };
      var primes = {
        k256: null,
        p224: null,
        p192: null,
        p25519: null
      };
      function MPrime(name, p) {
        this.name = name;
        this.p = new BN2(p, 16);
        this.n = this.p.bitLength();
        this.k = new BN2(1).iushln(this.n).isub(this.p);
        this.tmp = this._tmp();
      }
      MPrime.prototype._tmp = function _tmp() {
        var tmp = new BN2(null);
        tmp.words = new Array(Math.ceil(this.n / 13));
        return tmp;
      };
      MPrime.prototype.ireduce = function ireduce(num) {
        var r = num;
        var rlen;
        do {
          this.split(r, this.tmp);
          r = this.imulK(r);
          r = r.iadd(this.tmp);
          rlen = r.bitLength();
        } while (rlen > this.n);
        var cmp = rlen < this.n ? -1 : r.ucmp(this.p);
        if (cmp === 0) {
          r.words[0] = 0;
          r.length = 1;
        } else if (cmp > 0) {
          r.isub(this.p);
        } else {
          if (r.strip !== void 0) {
            r.strip();
          } else {
            r._strip();
          }
        }
        return r;
      };
      MPrime.prototype.split = function split(input, out) {
        input.iushrn(this.n, 0, out);
      };
      MPrime.prototype.imulK = function imulK(num) {
        return num.imul(this.k);
      };
      function K256() {
        MPrime.call(
          this,
          "k256",
          "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f"
        );
      }
      inherits(K256, MPrime);
      K256.prototype.split = function split(input, output) {
        var mask = 4194303;
        var outLen = Math.min(input.length, 9);
        for (var i = 0; i < outLen; i++) {
          output.words[i] = input.words[i];
        }
        output.length = outLen;
        if (input.length <= 9) {
          input.words[0] = 0;
          input.length = 1;
          return;
        }
        var prev = input.words[9];
        output.words[output.length++] = prev & mask;
        for (i = 10; i < input.length; i++) {
          var next = input.words[i] | 0;
          input.words[i - 10] = (next & mask) << 4 | prev >>> 22;
          prev = next;
        }
        prev >>>= 22;
        input.words[i - 10] = prev;
        if (prev === 0 && input.length > 10) {
          input.length -= 10;
        } else {
          input.length -= 9;
        }
      };
      K256.prototype.imulK = function imulK(num) {
        num.words[num.length] = 0;
        num.words[num.length + 1] = 0;
        num.length += 2;
        var lo = 0;
        for (var i = 0; i < num.length; i++) {
          var w = num.words[i] | 0;
          lo += w * 977;
          num.words[i] = lo & 67108863;
          lo = w * 64 + (lo / 67108864 | 0);
        }
        if (num.words[num.length - 1] === 0) {
          num.length--;
          if (num.words[num.length - 1] === 0) {
            num.length--;
          }
        }
        return num;
      };
      function P224() {
        MPrime.call(
          this,
          "p224",
          "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001"
        );
      }
      inherits(P224, MPrime);
      function P192() {
        MPrime.call(
          this,
          "p192",
          "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff"
        );
      }
      inherits(P192, MPrime);
      function P25519() {
        MPrime.call(
          this,
          "25519",
          "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed"
        );
      }
      inherits(P25519, MPrime);
      P25519.prototype.imulK = function imulK(num) {
        var carry = 0;
        for (var i = 0; i < num.length; i++) {
          var hi = (num.words[i] | 0) * 19 + carry;
          var lo = hi & 67108863;
          hi >>>= 26;
          num.words[i] = lo;
          carry = hi;
        }
        if (carry !== 0) {
          num.words[num.length++] = carry;
        }
        return num;
      };
      BN2._prime = function prime(name) {
        if (primes[name]) return primes[name];
        var prime2;
        if (name === "k256") {
          prime2 = new K256();
        } else if (name === "p224") {
          prime2 = new P224();
        } else if (name === "p192") {
          prime2 = new P192();
        } else if (name === "p25519") {
          prime2 = new P25519();
        } else {
          throw new Error("Unknown prime " + name);
        }
        primes[name] = prime2;
        return prime2;
      };
      function Red(m) {
        if (typeof m === "string") {
          var prime = BN2._prime(m);
          this.m = prime.p;
          this.prime = prime;
        } else {
          assert(m.gtn(1), "modulus must be greater than 1");
          this.m = m;
          this.prime = null;
        }
      }
      Red.prototype._verify1 = function _verify1(a) {
        assert(a.negative === 0, "red works only with positives");
        assert(a.red, "red works only with red numbers");
      };
      Red.prototype._verify2 = function _verify2(a, b) {
        assert((a.negative | b.negative) === 0, "red works only with positives");
        assert(
          a.red && a.red === b.red,
          "red works only with red numbers"
        );
      };
      Red.prototype.imod = function imod(a) {
        if (this.prime) return this.prime.ireduce(a)._forceRed(this);
        move(a, a.umod(this.m)._forceRed(this));
        return a;
      };
      Red.prototype.neg = function neg(a) {
        if (a.isZero()) {
          return a.clone();
        }
        return this.m.sub(a)._forceRed(this);
      };
      Red.prototype.add = function add(a, b) {
        this._verify2(a, b);
        var res = a.add(b);
        if (res.cmp(this.m) >= 0) {
          res.isub(this.m);
        }
        return res._forceRed(this);
      };
      Red.prototype.iadd = function iadd(a, b) {
        this._verify2(a, b);
        var res = a.iadd(b);
        if (res.cmp(this.m) >= 0) {
          res.isub(this.m);
        }
        return res;
      };
      Red.prototype.sub = function sub(a, b) {
        this._verify2(a, b);
        var res = a.sub(b);
        if (res.cmpn(0) < 0) {
          res.iadd(this.m);
        }
        return res._forceRed(this);
      };
      Red.prototype.isub = function isub(a, b) {
        this._verify2(a, b);
        var res = a.isub(b);
        if (res.cmpn(0) < 0) {
          res.iadd(this.m);
        }
        return res;
      };
      Red.prototype.shl = function shl(a, num) {
        this._verify1(a);
        return this.imod(a.ushln(num));
      };
      Red.prototype.imul = function imul(a, b) {
        this._verify2(a, b);
        return this.imod(a.imul(b));
      };
      Red.prototype.mul = function mul(a, b) {
        this._verify2(a, b);
        return this.imod(a.mul(b));
      };
      Red.prototype.isqr = function isqr(a) {
        return this.imul(a, a.clone());
      };
      Red.prototype.sqr = function sqr(a) {
        return this.mul(a, a);
      };
      Red.prototype.sqrt = function sqrt2(a) {
        if (a.isZero()) return a.clone();
        var mod3 = this.m.andln(3);
        assert(mod3 % 2 === 1);
        if (mod3 === 3) {
          var pow = this.m.add(new BN2(1)).iushrn(2);
          return this.pow(a, pow);
        }
        var q = this.m.subn(1);
        var s = 0;
        while (!q.isZero() && q.andln(1) === 0) {
          s++;
          q.iushrn(1);
        }
        assert(!q.isZero());
        var one = new BN2(1).toRed(this);
        var nOne = one.redNeg();
        var lpow = this.m.subn(1).iushrn(1);
        var z = this.m.bitLength();
        z = new BN2(2 * z * z).toRed(this);
        while (this.pow(z, lpow).cmp(nOne) !== 0) {
          z.redIAdd(nOne);
        }
        var c = this.pow(z, q);
        var r = this.pow(a, q.addn(1).iushrn(1));
        var t = this.pow(a, q);
        var m = s;
        while (t.cmp(one) !== 0) {
          var tmp = t;
          for (var i = 0; tmp.cmp(one) !== 0; i++) {
            tmp = tmp.redSqr();
          }
          assert(i < m);
          var b = this.pow(c, new BN2(1).iushln(m - i - 1));
          r = r.redMul(b);
          c = b.redSqr();
          t = t.redMul(c);
          m = i;
        }
        return r;
      };
      Red.prototype.invm = function invm(a) {
        var inv = a._invmp(this.m);
        if (inv.negative !== 0) {
          inv.negative = 0;
          return this.imod(inv).redNeg();
        } else {
          return this.imod(inv);
        }
      };
      Red.prototype.pow = function pow(a, num) {
        if (num.isZero()) return new BN2(1).toRed(this);
        if (num.cmpn(1) === 0) return a.clone();
        var windowSize = 4;
        var wnd = new Array(1 << windowSize);
        wnd[0] = new BN2(1).toRed(this);
        wnd[1] = a;
        for (var i = 2; i < wnd.length; i++) {
          wnd[i] = this.mul(wnd[i - 1], a);
        }
        var res = wnd[0];
        var current = 0;
        var currentLen = 0;
        var start = num.bitLength() % 26;
        if (start === 0) {
          start = 26;
        }
        for (i = num.length - 1; i >= 0; i--) {
          var word = num.words[i];
          for (var j = start - 1; j >= 0; j--) {
            var bit = word >> j & 1;
            if (res !== wnd[0]) {
              res = this.sqr(res);
            }
            if (bit === 0 && current === 0) {
              currentLen = 0;
              continue;
            }
            current <<= 1;
            current |= bit;
            currentLen++;
            if (currentLen !== windowSize && (i !== 0 || j !== 0)) continue;
            res = this.mul(res, wnd[current]);
            currentLen = 0;
            current = 0;
          }
          start = 26;
        }
        return res;
      };
      Red.prototype.convertTo = function convertTo(num) {
        var r = num.umod(this.m);
        return r === num ? r.clone() : r;
      };
      Red.prototype.convertFrom = function convertFrom(num) {
        var res = num.clone();
        res.red = null;
        return res;
      };
      BN2.mont = function mont(num) {
        return new Mont(num);
      };
      function Mont(m) {
        Red.call(this, m);
        this.shift = this.m.bitLength();
        if (this.shift % 26 !== 0) {
          this.shift += 26 - this.shift % 26;
        }
        this.r = new BN2(1).iushln(this.shift);
        this.r2 = this.imod(this.r.sqr());
        this.rinv = this.r._invmp(this.m);
        this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
        this.minv = this.minv.umod(this.r);
        this.minv = this.r.sub(this.minv);
      }
      inherits(Mont, Red);
      Mont.prototype.convertTo = function convertTo(num) {
        return this.imod(num.ushln(this.shift));
      };
      Mont.prototype.convertFrom = function convertFrom(num) {
        var r = this.imod(num.mul(this.rinv));
        r.red = null;
        return r;
      };
      Mont.prototype.imul = function imul(a, b) {
        if (a.isZero() || b.isZero()) {
          a.words[0] = 0;
          a.length = 1;
          return a;
        }
        var t = a.imul(b);
        var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
        var u = t.isub(c).iushrn(this.shift);
        var res = u;
        if (u.cmp(this.m) >= 0) {
          res = u.isub(this.m);
        } else if (u.cmpn(0) < 0) {
          res = u.iadd(this.m);
        }
        return res._forceRed(this);
      };
      Mont.prototype.mul = function mul(a, b) {
        if (a.isZero() || b.isZero()) return new BN2(0)._forceRed(this);
        var t = a.mul(b);
        var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
        var u = t.isub(c).iushrn(this.shift);
        var res = u;
        if (u.cmp(this.m) >= 0) {
          res = u.isub(this.m);
        } else if (u.cmpn(0) < 0) {
          res = u.iadd(this.m);
        }
        return res._forceRed(this);
      };
      Mont.prototype.invm = function invm(a) {
        var res = this.imod(a._invmp(this.m).mul(this.r2));
        return res._forceRed(this);
      };
    })(typeof module === "undefined" || module, exports);
  }
});

// ../../node_modules/js-sha3/src/sha3.js
var require_sha3 = __commonJS({
  "../../node_modules/js-sha3/src/sha3.js"(exports, module) {
    "use strict";
    (function() {
      "use strict";
      var INPUT_ERROR = "input is invalid type";
      var FINALIZE_ERROR = "finalize already called";
      var WINDOW = typeof window === "object";
      var root = WINDOW ? window : {};
      if (root.JS_SHA3_NO_WINDOW) {
        WINDOW = false;
      }
      var WEB_WORKER = !WINDOW && typeof self === "object";
      var NODE_JS = !root.JS_SHA3_NO_NODE_JS && typeof process === "object" && process.versions && process.versions.node;
      if (NODE_JS) {
        root = global;
      } else if (WEB_WORKER) {
        root = self;
      }
      var COMMON_JS = !root.JS_SHA3_NO_COMMON_JS && typeof module === "object" && module.exports;
      var AMD = typeof define === "function" && define.amd;
      var ARRAY_BUFFER = !root.JS_SHA3_NO_ARRAY_BUFFER && typeof ArrayBuffer !== "undefined";
      var HEX_CHARS = "0123456789abcdef".split("");
      var SHAKE_PADDING = [31, 7936, 2031616, 520093696];
      var CSHAKE_PADDING = [4, 1024, 262144, 67108864];
      var KECCAK_PADDING = [1, 256, 65536, 16777216];
      var PADDING = [6, 1536, 393216, 100663296];
      var SHIFT = [0, 8, 16, 24];
      var RC = [
        1,
        0,
        32898,
        0,
        32906,
        2147483648,
        2147516416,
        2147483648,
        32907,
        0,
        2147483649,
        0,
        2147516545,
        2147483648,
        32777,
        2147483648,
        138,
        0,
        136,
        0,
        2147516425,
        0,
        2147483658,
        0,
        2147516555,
        0,
        139,
        2147483648,
        32905,
        2147483648,
        32771,
        2147483648,
        32770,
        2147483648,
        128,
        2147483648,
        32778,
        0,
        2147483658,
        2147483648,
        2147516545,
        2147483648,
        32896,
        2147483648,
        2147483649,
        0,
        2147516424,
        2147483648
      ];
      var BITS = [224, 256, 384, 512];
      var SHAKE_BITS = [128, 256];
      var OUTPUT_TYPES = ["hex", "buffer", "arrayBuffer", "array", "digest"];
      var CSHAKE_BYTEPAD = {
        "128": 168,
        "256": 136
      };
      if (root.JS_SHA3_NO_NODE_JS || !Array.isArray) {
        Array.isArray = function(obj) {
          return Object.prototype.toString.call(obj) === "[object Array]";
        };
      }
      if (ARRAY_BUFFER && (root.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)) {
        ArrayBuffer.isView = function(obj) {
          return typeof obj === "object" && obj.buffer && obj.buffer.constructor === ArrayBuffer;
        };
      }
      var createOutputMethod = function(bits2, padding, outputType) {
        return function(message) {
          return new Keccak(bits2, padding, bits2).update(message)[outputType]();
        };
      };
      var createShakeOutputMethod = function(bits2, padding, outputType) {
        return function(message, outputBits) {
          return new Keccak(bits2, padding, outputBits).update(message)[outputType]();
        };
      };
      var createCshakeOutputMethod = function(bits2, padding, outputType) {
        return function(message, outputBits, n, s) {
          return methods["cshake" + bits2].update(message, outputBits, n, s)[outputType]();
        };
      };
      var createKmacOutputMethod = function(bits2, padding, outputType) {
        return function(key, message, outputBits, s) {
          return methods["kmac" + bits2].update(key, message, outputBits, s)[outputType]();
        };
      };
      var createOutputMethods = function(method, createMethod2, bits2, padding) {
        for (var i2 = 0; i2 < OUTPUT_TYPES.length; ++i2) {
          var type = OUTPUT_TYPES[i2];
          method[type] = createMethod2(bits2, padding, type);
        }
        return method;
      };
      var createMethod = function(bits2, padding) {
        var method = createOutputMethod(bits2, padding, "hex");
        method.create = function() {
          return new Keccak(bits2, padding, bits2);
        };
        method.update = function(message) {
          return method.create().update(message);
        };
        return createOutputMethods(method, createOutputMethod, bits2, padding);
      };
      var createShakeMethod = function(bits2, padding) {
        var method = createShakeOutputMethod(bits2, padding, "hex");
        method.create = function(outputBits) {
          return new Keccak(bits2, padding, outputBits);
        };
        method.update = function(message, outputBits) {
          return method.create(outputBits).update(message);
        };
        return createOutputMethods(method, createShakeOutputMethod, bits2, padding);
      };
      var createCshakeMethod = function(bits2, padding) {
        var w = CSHAKE_BYTEPAD[bits2];
        var method = createCshakeOutputMethod(bits2, padding, "hex");
        method.create = function(outputBits, n, s) {
          if (!n && !s) {
            return methods["shake" + bits2].create(outputBits);
          } else {
            return new Keccak(bits2, padding, outputBits).bytepad([n, s], w);
          }
        };
        method.update = function(message, outputBits, n, s) {
          return method.create(outputBits, n, s).update(message);
        };
        return createOutputMethods(method, createCshakeOutputMethod, bits2, padding);
      };
      var createKmacMethod = function(bits2, padding) {
        var w = CSHAKE_BYTEPAD[bits2];
        var method = createKmacOutputMethod(bits2, padding, "hex");
        method.create = function(key, outputBits, s) {
          return new Kmac(bits2, padding, outputBits).bytepad(["KMAC", s], w).bytepad([key], w);
        };
        method.update = function(key, message, outputBits, s) {
          return method.create(key, outputBits, s).update(message);
        };
        return createOutputMethods(method, createKmacOutputMethod, bits2, padding);
      };
      var algorithms = [
        { name: "keccak", padding: KECCAK_PADDING, bits: BITS, createMethod },
        { name: "sha3", padding: PADDING, bits: BITS, createMethod },
        { name: "shake", padding: SHAKE_PADDING, bits: SHAKE_BITS, createMethod: createShakeMethod },
        { name: "cshake", padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createCshakeMethod },
        { name: "kmac", padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createKmacMethod }
      ];
      var methods = {}, methodNames = [];
      for (var i = 0; i < algorithms.length; ++i) {
        var algorithm = algorithms[i];
        var bits = algorithm.bits;
        for (var j = 0; j < bits.length; ++j) {
          var methodName = algorithm.name + "_" + bits[j];
          methodNames.push(methodName);
          methods[methodName] = algorithm.createMethod(bits[j], algorithm.padding);
          if (algorithm.name !== "sha3") {
            var newMethodName = algorithm.name + bits[j];
            methodNames.push(newMethodName);
            methods[newMethodName] = methods[methodName];
          }
        }
      }
      function Keccak(bits2, padding, outputBits) {
        this.blocks = [];
        this.s = [];
        this.padding = padding;
        this.outputBits = outputBits;
        this.reset = true;
        this.finalized = false;
        this.block = 0;
        this.start = 0;
        this.blockCount = 1600 - (bits2 << 1) >> 5;
        this.byteCount = this.blockCount << 2;
        this.outputBlocks = outputBits >> 5;
        this.extraBytes = (outputBits & 31) >> 3;
        for (var i2 = 0; i2 < 50; ++i2) {
          this.s[i2] = 0;
        }
      }
      Keccak.prototype.update = function(message) {
        if (this.finalized) {
          throw new Error(FINALIZE_ERROR);
        }
        var notString, type = typeof message;
        if (type !== "string") {
          if (type === "object") {
            if (message === null) {
              throw new Error(INPUT_ERROR);
            } else if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
              message = new Uint8Array(message);
            } else if (!Array.isArray(message)) {
              if (!ARRAY_BUFFER || !ArrayBuffer.isView(message)) {
                throw new Error(INPUT_ERROR);
              }
            }
          } else {
            throw new Error(INPUT_ERROR);
          }
          notString = true;
        }
        var blocks = this.blocks, byteCount = this.byteCount, length = message.length, blockCount = this.blockCount, index = 0, s = this.s, i2, code;
        while (index < length) {
          if (this.reset) {
            this.reset = false;
            blocks[0] = this.block;
            for (i2 = 1; i2 < blockCount + 1; ++i2) {
              blocks[i2] = 0;
            }
          }
          if (notString) {
            for (i2 = this.start; index < length && i2 < byteCount; ++index) {
              blocks[i2 >> 2] |= message[index] << SHIFT[i2++ & 3];
            }
          } else {
            for (i2 = this.start; index < length && i2 < byteCount; ++index) {
              code = message.charCodeAt(index);
              if (code < 128) {
                blocks[i2 >> 2] |= code << SHIFT[i2++ & 3];
              } else if (code < 2048) {
                blocks[i2 >> 2] |= (192 | code >> 6) << SHIFT[i2++ & 3];
                blocks[i2 >> 2] |= (128 | code & 63) << SHIFT[i2++ & 3];
              } else if (code < 55296 || code >= 57344) {
                blocks[i2 >> 2] |= (224 | code >> 12) << SHIFT[i2++ & 3];
                blocks[i2 >> 2] |= (128 | code >> 6 & 63) << SHIFT[i2++ & 3];
                blocks[i2 >> 2] |= (128 | code & 63) << SHIFT[i2++ & 3];
              } else {
                code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
                blocks[i2 >> 2] |= (240 | code >> 18) << SHIFT[i2++ & 3];
                blocks[i2 >> 2] |= (128 | code >> 12 & 63) << SHIFT[i2++ & 3];
                blocks[i2 >> 2] |= (128 | code >> 6 & 63) << SHIFT[i2++ & 3];
                blocks[i2 >> 2] |= (128 | code & 63) << SHIFT[i2++ & 3];
              }
            }
          }
          this.lastByteIndex = i2;
          if (i2 >= byteCount) {
            this.start = i2 - byteCount;
            this.block = blocks[blockCount];
            for (i2 = 0; i2 < blockCount; ++i2) {
              s[i2] ^= blocks[i2];
            }
            f(s);
            this.reset = true;
          } else {
            this.start = i2;
          }
        }
        return this;
      };
      Keccak.prototype.encode = function(x, right) {
        var o = x & 255, n = 1;
        var bytes = [o];
        x = x >> 8;
        o = x & 255;
        while (o > 0) {
          bytes.unshift(o);
          x = x >> 8;
          o = x & 255;
          ++n;
        }
        if (right) {
          bytes.push(n);
        } else {
          bytes.unshift(n);
        }
        this.update(bytes);
        return bytes.length;
      };
      Keccak.prototype.encodeString = function(str) {
        var notString, type = typeof str;
        if (type !== "string") {
          if (type === "object") {
            if (str === null) {
              throw new Error(INPUT_ERROR);
            } else if (ARRAY_BUFFER && str.constructor === ArrayBuffer) {
              str = new Uint8Array(str);
            } else if (!Array.isArray(str)) {
              if (!ARRAY_BUFFER || !ArrayBuffer.isView(str)) {
                throw new Error(INPUT_ERROR);
              }
            }
          } else {
            throw new Error(INPUT_ERROR);
          }
          notString = true;
        }
        var bytes = 0, length = str.length;
        if (notString) {
          bytes = length;
        } else {
          for (var i2 = 0; i2 < str.length; ++i2) {
            var code = str.charCodeAt(i2);
            if (code < 128) {
              bytes += 1;
            } else if (code < 2048) {
              bytes += 2;
            } else if (code < 55296 || code >= 57344) {
              bytes += 3;
            } else {
              code = 65536 + ((code & 1023) << 10 | str.charCodeAt(++i2) & 1023);
              bytes += 4;
            }
          }
        }
        bytes += this.encode(bytes * 8);
        this.update(str);
        return bytes;
      };
      Keccak.prototype.bytepad = function(strs, w) {
        var bytes = this.encode(w);
        for (var i2 = 0; i2 < strs.length; ++i2) {
          bytes += this.encodeString(strs[i2]);
        }
        var paddingBytes = w - bytes % w;
        var zeros = [];
        zeros.length = paddingBytes;
        this.update(zeros);
        return this;
      };
      Keccak.prototype.finalize = function() {
        if (this.finalized) {
          return;
        }
        this.finalized = true;
        var blocks = this.blocks, i2 = this.lastByteIndex, blockCount = this.blockCount, s = this.s;
        blocks[i2 >> 2] |= this.padding[i2 & 3];
        if (this.lastByteIndex === this.byteCount) {
          blocks[0] = blocks[blockCount];
          for (i2 = 1; i2 < blockCount + 1; ++i2) {
            blocks[i2] = 0;
          }
        }
        blocks[blockCount - 1] |= 2147483648;
        for (i2 = 0; i2 < blockCount; ++i2) {
          s[i2] ^= blocks[i2];
        }
        f(s);
      };
      Keccak.prototype.toString = Keccak.prototype.hex = function() {
        this.finalize();
        var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks, extraBytes = this.extraBytes, i2 = 0, j2 = 0;
        var hex = "", block;
        while (j2 < outputBlocks) {
          for (i2 = 0; i2 < blockCount && j2 < outputBlocks; ++i2, ++j2) {
            block = s[i2];
            hex += HEX_CHARS[block >> 4 & 15] + HEX_CHARS[block & 15] + HEX_CHARS[block >> 12 & 15] + HEX_CHARS[block >> 8 & 15] + HEX_CHARS[block >> 20 & 15] + HEX_CHARS[block >> 16 & 15] + HEX_CHARS[block >> 28 & 15] + HEX_CHARS[block >> 24 & 15];
          }
          if (j2 % blockCount === 0) {
            f(s);
            i2 = 0;
          }
        }
        if (extraBytes) {
          block = s[i2];
          hex += HEX_CHARS[block >> 4 & 15] + HEX_CHARS[block & 15];
          if (extraBytes > 1) {
            hex += HEX_CHARS[block >> 12 & 15] + HEX_CHARS[block >> 8 & 15];
          }
          if (extraBytes > 2) {
            hex += HEX_CHARS[block >> 20 & 15] + HEX_CHARS[block >> 16 & 15];
          }
        }
        return hex;
      };
      Keccak.prototype.arrayBuffer = function() {
        this.finalize();
        var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks, extraBytes = this.extraBytes, i2 = 0, j2 = 0;
        var bytes = this.outputBits >> 3;
        var buffer;
        if (extraBytes) {
          buffer = new ArrayBuffer(outputBlocks + 1 << 2);
        } else {
          buffer = new ArrayBuffer(bytes);
        }
        var array = new Uint32Array(buffer);
        while (j2 < outputBlocks) {
          for (i2 = 0; i2 < blockCount && j2 < outputBlocks; ++i2, ++j2) {
            array[j2] = s[i2];
          }
          if (j2 % blockCount === 0) {
            f(s);
          }
        }
        if (extraBytes) {
          array[i2] = s[i2];
          buffer = buffer.slice(0, bytes);
        }
        return buffer;
      };
      Keccak.prototype.buffer = Keccak.prototype.arrayBuffer;
      Keccak.prototype.digest = Keccak.prototype.array = function() {
        this.finalize();
        var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks, extraBytes = this.extraBytes, i2 = 0, j2 = 0;
        var array = [], offset, block;
        while (j2 < outputBlocks) {
          for (i2 = 0; i2 < blockCount && j2 < outputBlocks; ++i2, ++j2) {
            offset = j2 << 2;
            block = s[i2];
            array[offset] = block & 255;
            array[offset + 1] = block >> 8 & 255;
            array[offset + 2] = block >> 16 & 255;
            array[offset + 3] = block >> 24 & 255;
          }
          if (j2 % blockCount === 0) {
            f(s);
          }
        }
        if (extraBytes) {
          offset = j2 << 2;
          block = s[i2];
          array[offset] = block & 255;
          if (extraBytes > 1) {
            array[offset + 1] = block >> 8 & 255;
          }
          if (extraBytes > 2) {
            array[offset + 2] = block >> 16 & 255;
          }
        }
        return array;
      };
      function Kmac(bits2, padding, outputBits) {
        Keccak.call(this, bits2, padding, outputBits);
      }
      Kmac.prototype = new Keccak();
      Kmac.prototype.finalize = function() {
        this.encode(this.outputBits, true);
        return Keccak.prototype.finalize.call(this);
      };
      var f = function(s) {
        var h, l, n, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17, b18, b19, b20, b21, b22, b23, b24, b25, b26, b27, b28, b29, b30, b31, b32, b33, b34, b35, b36, b37, b38, b39, b40, b41, b42, b43, b44, b45, b46, b47, b48, b49;
        for (n = 0; n < 48; n += 2) {
          c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
          c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
          c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
          c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
          c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
          c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
          c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
          c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
          c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
          c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];
          h = c8 ^ (c2 << 1 | c3 >>> 31);
          l = c9 ^ (c3 << 1 | c2 >>> 31);
          s[0] ^= h;
          s[1] ^= l;
          s[10] ^= h;
          s[11] ^= l;
          s[20] ^= h;
          s[21] ^= l;
          s[30] ^= h;
          s[31] ^= l;
          s[40] ^= h;
          s[41] ^= l;
          h = c0 ^ (c4 << 1 | c5 >>> 31);
          l = c1 ^ (c5 << 1 | c4 >>> 31);
          s[2] ^= h;
          s[3] ^= l;
          s[12] ^= h;
          s[13] ^= l;
          s[22] ^= h;
          s[23] ^= l;
          s[32] ^= h;
          s[33] ^= l;
          s[42] ^= h;
          s[43] ^= l;
          h = c2 ^ (c6 << 1 | c7 >>> 31);
          l = c3 ^ (c7 << 1 | c6 >>> 31);
          s[4] ^= h;
          s[5] ^= l;
          s[14] ^= h;
          s[15] ^= l;
          s[24] ^= h;
          s[25] ^= l;
          s[34] ^= h;
          s[35] ^= l;
          s[44] ^= h;
          s[45] ^= l;
          h = c4 ^ (c8 << 1 | c9 >>> 31);
          l = c5 ^ (c9 << 1 | c8 >>> 31);
          s[6] ^= h;
          s[7] ^= l;
          s[16] ^= h;
          s[17] ^= l;
          s[26] ^= h;
          s[27] ^= l;
          s[36] ^= h;
          s[37] ^= l;
          s[46] ^= h;
          s[47] ^= l;
          h = c6 ^ (c0 << 1 | c1 >>> 31);
          l = c7 ^ (c1 << 1 | c0 >>> 31);
          s[8] ^= h;
          s[9] ^= l;
          s[18] ^= h;
          s[19] ^= l;
          s[28] ^= h;
          s[29] ^= l;
          s[38] ^= h;
          s[39] ^= l;
          s[48] ^= h;
          s[49] ^= l;
          b0 = s[0];
          b1 = s[1];
          b32 = s[11] << 4 | s[10] >>> 28;
          b33 = s[10] << 4 | s[11] >>> 28;
          b14 = s[20] << 3 | s[21] >>> 29;
          b15 = s[21] << 3 | s[20] >>> 29;
          b46 = s[31] << 9 | s[30] >>> 23;
          b47 = s[30] << 9 | s[31] >>> 23;
          b28 = s[40] << 18 | s[41] >>> 14;
          b29 = s[41] << 18 | s[40] >>> 14;
          b20 = s[2] << 1 | s[3] >>> 31;
          b21 = s[3] << 1 | s[2] >>> 31;
          b2 = s[13] << 12 | s[12] >>> 20;
          b3 = s[12] << 12 | s[13] >>> 20;
          b34 = s[22] << 10 | s[23] >>> 22;
          b35 = s[23] << 10 | s[22] >>> 22;
          b16 = s[33] << 13 | s[32] >>> 19;
          b17 = s[32] << 13 | s[33] >>> 19;
          b48 = s[42] << 2 | s[43] >>> 30;
          b49 = s[43] << 2 | s[42] >>> 30;
          b40 = s[5] << 30 | s[4] >>> 2;
          b41 = s[4] << 30 | s[5] >>> 2;
          b22 = s[14] << 6 | s[15] >>> 26;
          b23 = s[15] << 6 | s[14] >>> 26;
          b4 = s[25] << 11 | s[24] >>> 21;
          b5 = s[24] << 11 | s[25] >>> 21;
          b36 = s[34] << 15 | s[35] >>> 17;
          b37 = s[35] << 15 | s[34] >>> 17;
          b18 = s[45] << 29 | s[44] >>> 3;
          b19 = s[44] << 29 | s[45] >>> 3;
          b10 = s[6] << 28 | s[7] >>> 4;
          b11 = s[7] << 28 | s[6] >>> 4;
          b42 = s[17] << 23 | s[16] >>> 9;
          b43 = s[16] << 23 | s[17] >>> 9;
          b24 = s[26] << 25 | s[27] >>> 7;
          b25 = s[27] << 25 | s[26] >>> 7;
          b6 = s[36] << 21 | s[37] >>> 11;
          b7 = s[37] << 21 | s[36] >>> 11;
          b38 = s[47] << 24 | s[46] >>> 8;
          b39 = s[46] << 24 | s[47] >>> 8;
          b30 = s[8] << 27 | s[9] >>> 5;
          b31 = s[9] << 27 | s[8] >>> 5;
          b12 = s[18] << 20 | s[19] >>> 12;
          b13 = s[19] << 20 | s[18] >>> 12;
          b44 = s[29] << 7 | s[28] >>> 25;
          b45 = s[28] << 7 | s[29] >>> 25;
          b26 = s[38] << 8 | s[39] >>> 24;
          b27 = s[39] << 8 | s[38] >>> 24;
          b8 = s[48] << 14 | s[49] >>> 18;
          b9 = s[49] << 14 | s[48] >>> 18;
          s[0] = b0 ^ ~b2 & b4;
          s[1] = b1 ^ ~b3 & b5;
          s[10] = b10 ^ ~b12 & b14;
          s[11] = b11 ^ ~b13 & b15;
          s[20] = b20 ^ ~b22 & b24;
          s[21] = b21 ^ ~b23 & b25;
          s[30] = b30 ^ ~b32 & b34;
          s[31] = b31 ^ ~b33 & b35;
          s[40] = b40 ^ ~b42 & b44;
          s[41] = b41 ^ ~b43 & b45;
          s[2] = b2 ^ ~b4 & b6;
          s[3] = b3 ^ ~b5 & b7;
          s[12] = b12 ^ ~b14 & b16;
          s[13] = b13 ^ ~b15 & b17;
          s[22] = b22 ^ ~b24 & b26;
          s[23] = b23 ^ ~b25 & b27;
          s[32] = b32 ^ ~b34 & b36;
          s[33] = b33 ^ ~b35 & b37;
          s[42] = b42 ^ ~b44 & b46;
          s[43] = b43 ^ ~b45 & b47;
          s[4] = b4 ^ ~b6 & b8;
          s[5] = b5 ^ ~b7 & b9;
          s[14] = b14 ^ ~b16 & b18;
          s[15] = b15 ^ ~b17 & b19;
          s[24] = b24 ^ ~b26 & b28;
          s[25] = b25 ^ ~b27 & b29;
          s[34] = b34 ^ ~b36 & b38;
          s[35] = b35 ^ ~b37 & b39;
          s[44] = b44 ^ ~b46 & b48;
          s[45] = b45 ^ ~b47 & b49;
          s[6] = b6 ^ ~b8 & b0;
          s[7] = b7 ^ ~b9 & b1;
          s[16] = b16 ^ ~b18 & b10;
          s[17] = b17 ^ ~b19 & b11;
          s[26] = b26 ^ ~b28 & b20;
          s[27] = b27 ^ ~b29 & b21;
          s[36] = b36 ^ ~b38 & b30;
          s[37] = b37 ^ ~b39 & b31;
          s[46] = b46 ^ ~b48 & b40;
          s[47] = b47 ^ ~b49 & b41;
          s[8] = b8 ^ ~b0 & b2;
          s[9] = b9 ^ ~b1 & b3;
          s[18] = b18 ^ ~b10 & b12;
          s[19] = b19 ^ ~b11 & b13;
          s[28] = b28 ^ ~b20 & b22;
          s[29] = b29 ^ ~b21 & b23;
          s[38] = b38 ^ ~b30 & b32;
          s[39] = b39 ^ ~b31 & b33;
          s[48] = b48 ^ ~b40 & b42;
          s[49] = b49 ^ ~b41 & b43;
          s[0] ^= RC[n];
          s[1] ^= RC[n + 1];
        }
      };
      if (COMMON_JS) {
        module.exports = methods;
      } else {
        for (i = 0; i < methodNames.length; ++i) {
          root[methodNames[i]] = methods[methodNames[i]];
        }
        if (AMD) {
          define(function() {
            return methods;
          });
        }
      }
    })();
  }
});

// src/entities/doppler/ReadDoppler.ts
import { Drift as Drift3 } from "@delvtech/drift";

// src/abis/abis.ts
var customRouterAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "swapRouter_",
        type: "address",
        internalType: "contract PoolSwapTest"
      },
      { name: "quoter_", type: "address", internalType: "contract Quoter" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "IS_TEST",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "buy",
    inputs: [
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "amount", type: "int256", internalType: "int256" }
    ],
    outputs: [
      { name: "", type: "uint256", internalType: "uint256" },
      { name: "", type: "uint256", internalType: "uint256" }
    ],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "buyExactIn",
    inputs: [
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "amount", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "bought", type: "uint256", internalType: "uint256" }],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "buyExactOut",
    inputs: [
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "amount", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "spent", type: "uint256", internalType: "uint256" }],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "computeBuyExactOut",
    inputs: [
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "amountOut", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "computeSellExactOut",
    inputs: [
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "amountOut", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "excludeArtifacts",
    inputs: [],
    outputs: [
      {
        name: "excludedArtifacts_",
        type: "string[]",
        internalType: "string[]"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "excludeContracts",
    inputs: [],
    outputs: [
      {
        name: "excludedContracts_",
        type: "address[]",
        internalType: "address[]"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "excludeSelectors",
    inputs: [],
    outputs: [
      {
        name: "excludedSelectors_",
        type: "tuple[]",
        internalType: "struct StdInvariant.FuzzSelector[]",
        components: [
          { name: "addr", type: "address", internalType: "address" },
          { name: "selectors", type: "bytes4[]", internalType: "bytes4[]" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "excludeSenders",
    inputs: [],
    outputs: [
      {
        name: "excludedSenders_",
        type: "address[]",
        internalType: "address[]"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "failed",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "mintAndBuy",
    inputs: [
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "amount", type: "int256", internalType: "int256" }
    ],
    outputs: [
      { name: "", type: "uint256", internalType: "uint256" },
      { name: "", type: "uint256", internalType: "uint256" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "quoter",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract Quoter" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "sell",
    inputs: [
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "amount", type: "int256", internalType: "int256" }
    ],
    outputs: [
      { name: "", type: "uint256", internalType: "uint256" },
      { name: "", type: "uint256", internalType: "uint256" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "sellExactIn",
    inputs: [
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "amount", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "received", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "sellExactOut",
    inputs: [
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "amount", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "sold", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "swapRouter",
    inputs: [],
    outputs: [
      { name: "", type: "address", internalType: "contract PoolSwapTest" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "targetArtifactSelectors",
    inputs: [],
    outputs: [
      {
        name: "targetedArtifactSelectors_",
        type: "tuple[]",
        internalType: "struct StdInvariant.FuzzArtifactSelector[]",
        components: [
          { name: "artifact", type: "string", internalType: "string" },
          { name: "selectors", type: "bytes4[]", internalType: "bytes4[]" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "targetArtifacts",
    inputs: [],
    outputs: [
      {
        name: "targetedArtifacts_",
        type: "string[]",
        internalType: "string[]"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "targetContracts",
    inputs: [],
    outputs: [
      {
        name: "targetedContracts_",
        type: "address[]",
        internalType: "address[]"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "targetInterfaces",
    inputs: [],
    outputs: [
      {
        name: "targetedInterfaces_",
        type: "tuple[]",
        internalType: "struct StdInvariant.FuzzInterface[]",
        components: [
          { name: "addr", type: "address", internalType: "address" },
          { name: "artifacts", type: "string[]", internalType: "string[]" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "targetSelectors",
    inputs: [],
    outputs: [
      {
        name: "targetedSelectors_",
        type: "tuple[]",
        internalType: "struct StdInvariant.FuzzSelector[]",
        components: [
          { name: "addr", type: "address", internalType: "address" },
          { name: "selectors", type: "bytes4[]", internalType: "bytes4[]" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "targetSenders",
    inputs: [],
    outputs: [
      {
        name: "targetedSenders_",
        type: "address[]",
        internalType: "address[]"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "log",
    inputs: [
      { name: "", type: "string", indexed: false, internalType: "string" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_address",
    inputs: [
      { name: "", type: "address", indexed: false, internalType: "address" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_array",
    inputs: [
      {
        name: "val",
        type: "uint256[]",
        indexed: false,
        internalType: "uint256[]"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_array",
    inputs: [
      {
        name: "val",
        type: "int256[]",
        indexed: false,
        internalType: "int256[]"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_array",
    inputs: [
      {
        name: "val",
        type: "address[]",
        indexed: false,
        internalType: "address[]"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_bytes",
    inputs: [
      { name: "", type: "bytes", indexed: false, internalType: "bytes" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_bytes32",
    inputs: [
      { name: "", type: "bytes32", indexed: false, internalType: "bytes32" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_int",
    inputs: [
      { name: "", type: "int256", indexed: false, internalType: "int256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_named_address",
    inputs: [
      { name: "key", type: "string", indexed: false, internalType: "string" },
      { name: "val", type: "address", indexed: false, internalType: "address" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_named_array",
    inputs: [
      { name: "key", type: "string", indexed: false, internalType: "string" },
      {
        name: "val",
        type: "uint256[]",
        indexed: false,
        internalType: "uint256[]"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_named_array",
    inputs: [
      { name: "key", type: "string", indexed: false, internalType: "string" },
      {
        name: "val",
        type: "int256[]",
        indexed: false,
        internalType: "int256[]"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_named_array",
    inputs: [
      { name: "key", type: "string", indexed: false, internalType: "string" },
      {
        name: "val",
        type: "address[]",
        indexed: false,
        internalType: "address[]"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_named_bytes",
    inputs: [
      { name: "key", type: "string", indexed: false, internalType: "string" },
      { name: "val", type: "bytes", indexed: false, internalType: "bytes" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_named_bytes32",
    inputs: [
      { name: "key", type: "string", indexed: false, internalType: "string" },
      { name: "val", type: "bytes32", indexed: false, internalType: "bytes32" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_named_decimal_int",
    inputs: [
      { name: "key", type: "string", indexed: false, internalType: "string" },
      { name: "val", type: "int256", indexed: false, internalType: "int256" },
      {
        name: "decimals",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_named_decimal_uint",
    inputs: [
      { name: "key", type: "string", indexed: false, internalType: "string" },
      { name: "val", type: "uint256", indexed: false, internalType: "uint256" },
      {
        name: "decimals",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_named_int",
    inputs: [
      { name: "key", type: "string", indexed: false, internalType: "string" },
      { name: "val", type: "int256", indexed: false, internalType: "int256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_named_string",
    inputs: [
      { name: "key", type: "string", indexed: false, internalType: "string" },
      { name: "val", type: "string", indexed: false, internalType: "string" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_named_uint",
    inputs: [
      { name: "key", type: "string", indexed: false, internalType: "string" },
      { name: "val", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_string",
    inputs: [
      { name: "", type: "string", indexed: false, internalType: "string" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "log_uint",
    inputs: [
      { name: "", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "logs",
    inputs: [
      { name: "", type: "bytes", indexed: false, internalType: "bytes" }
    ],
    anonymous: false
  }
];
var stateViewAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_poolManager",
        type: "address",
        internalType: "contract IPoolManager"
      }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getFeeGrowthGlobals",
    inputs: [{ name: "poolId", type: "bytes32", internalType: "PoolId" }],
    outputs: [
      { name: "feeGrowthGlobal0", type: "uint256", internalType: "uint256" },
      { name: "feeGrowthGlobal1", type: "uint256", internalType: "uint256" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getFeeGrowthInside",
    inputs: [
      { name: "poolId", type: "bytes32", internalType: "PoolId" },
      { name: "tickLower", type: "int24", internalType: "int24" },
      { name: "tickUpper", type: "int24", internalType: "int24" }
    ],
    outputs: [
      {
        name: "feeGrowthInside0X128",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "feeGrowthInside1X128",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getLiquidity",
    inputs: [{ name: "poolId", type: "bytes32", internalType: "PoolId" }],
    outputs: [{ name: "liquidity", type: "uint128", internalType: "uint128" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getPositionInfo",
    inputs: [
      { name: "poolId", type: "bytes32", internalType: "PoolId" },
      { name: "positionId", type: "bytes32", internalType: "bytes32" }
    ],
    outputs: [
      { name: "liquidity", type: "uint128", internalType: "uint128" },
      {
        name: "feeGrowthInside0LastX128",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "feeGrowthInside1LastX128",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getPositionInfo",
    inputs: [
      { name: "poolId", type: "bytes32", internalType: "PoolId" },
      { name: "owner", type: "address", internalType: "address" },
      { name: "tickLower", type: "int24", internalType: "int24" },
      { name: "tickUpper", type: "int24", internalType: "int24" },
      { name: "salt", type: "bytes32", internalType: "bytes32" }
    ],
    outputs: [
      { name: "liquidity", type: "uint128", internalType: "uint128" },
      {
        name: "feeGrowthInside0LastX128",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "feeGrowthInside1LastX128",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getPositionLiquidity",
    inputs: [
      { name: "poolId", type: "bytes32", internalType: "PoolId" },
      { name: "positionId", type: "bytes32", internalType: "bytes32" }
    ],
    outputs: [{ name: "liquidity", type: "uint128", internalType: "uint128" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getSlot0",
    inputs: [{ name: "poolId", type: "bytes32", internalType: "PoolId" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160", internalType: "uint160" },
      { name: "tick", type: "int24", internalType: "int24" },
      { name: "protocolFee", type: "uint24", internalType: "uint24" },
      { name: "lpFee", type: "uint24", internalType: "uint24" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getTickBitmap",
    inputs: [
      { name: "poolId", type: "bytes32", internalType: "PoolId" },
      { name: "tick", type: "int16", internalType: "int16" }
    ],
    outputs: [{ name: "tickBitmap", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getTickFeeGrowthOutside",
    inputs: [
      { name: "poolId", type: "bytes32", internalType: "PoolId" },
      { name: "tick", type: "int24", internalType: "int24" }
    ],
    outputs: [
      {
        name: "feeGrowthOutside0X128",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "feeGrowthOutside1X128",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getTickInfo",
    inputs: [
      { name: "poolId", type: "bytes32", internalType: "PoolId" },
      { name: "tick", type: "int24", internalType: "int24" }
    ],
    outputs: [
      { name: "liquidityGross", type: "uint128", internalType: "uint128" },
      { name: "liquidityNet", type: "int128", internalType: "int128" },
      {
        name: "feeGrowthOutside0X128",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "feeGrowthOutside1X128",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getTickLiquidity",
    inputs: [
      { name: "poolId", type: "bytes32", internalType: "PoolId" },
      { name: "tick", type: "int24", internalType: "int24" }
    ],
    outputs: [
      { name: "liquidityGross", type: "uint128", internalType: "uint128" },
      { name: "liquidityNet", type: "int128", internalType: "int128" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "poolManager",
    inputs: [],
    outputs: [
      { name: "", type: "address", internalType: "contract IPoolManager" }
    ],
    stateMutability: "view"
  }
];
var airlockAbi = [
  {
    type: "constructor",
    inputs: [{ name: "owner_", type: "address", internalType: "address" }],
    stateMutability: "nonpayable"
  },
  { type: "receive", stateMutability: "payable" },
  {
    type: "function",
    name: "collectIntegratorFees",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "collectProtocolFees",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "create",
    inputs: [
      {
        name: "createData",
        type: "tuple",
        internalType: "struct CreateParams",
        components: [
          { name: "initialSupply", type: "uint256", internalType: "uint256" },
          { name: "numTokensToSell", type: "uint256", internalType: "uint256" },
          { name: "numeraire", type: "address", internalType: "address" },
          {
            name: "tokenFactory",
            type: "address",
            internalType: "contract ITokenFactory"
          },
          { name: "tokenFactoryData", type: "bytes", internalType: "bytes" },
          {
            name: "governanceFactory",
            type: "address",
            internalType: "contract IGovernanceFactory"
          },
          {
            name: "governanceFactoryData",
            type: "bytes",
            internalType: "bytes"
          },
          {
            name: "poolInitializer",
            type: "address",
            internalType: "contract IPoolInitializer"
          },
          { name: "poolInitializerData", type: "bytes", internalType: "bytes" },
          {
            name: "liquidityMigrator",
            type: "address",
            internalType: "contract ILiquidityMigrator"
          },
          {
            name: "liquidityMigratorData",
            type: "bytes",
            internalType: "bytes"
          },
          { name: "integrator", type: "address", internalType: "address" },
          { name: "salt", type: "bytes32", internalType: "bytes32" }
        ]
      }
    ],
    outputs: [
      { name: "asset", type: "address", internalType: "address" },
      { name: "pool", type: "address", internalType: "address" },
      { name: "governance", type: "address", internalType: "address" },
      { name: "timelock", type: "address", internalType: "address" },
      { name: "migrationPool", type: "address", internalType: "address" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getAssetData",
    inputs: [{ name: "asset", type: "address", internalType: "address" }],
    outputs: [
      { name: "numeraire", type: "address", internalType: "address" },
      { name: "timelock", type: "address", internalType: "address" },
      { name: "governance", type: "address", internalType: "address" },
      {
        name: "liquidityMigrator",
        type: "address",
        internalType: "contract ILiquidityMigrator"
      },
      {
        name: "poolInitializer",
        type: "address",
        internalType: "contract IPoolInitializer"
      },
      { name: "pool", type: "address", internalType: "address" },
      { name: "migrationPool", type: "address", internalType: "address" },
      { name: "numTokensToSell", type: "uint256", internalType: "uint256" },
      { name: "totalSupply", type: "uint256", internalType: "uint256" },
      { name: "integrator", type: "address", internalType: "address" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getModuleState",
    inputs: [{ name: "module", type: "address", internalType: "address" }],
    outputs: [
      { name: "state", type: "uint8", internalType: "enum ModuleState" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "integratorFees",
    inputs: [
      { name: "integrator", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" }
    ],
    outputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "migrate",
    inputs: [{ name: "asset", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "protocolFees",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "setModuleState",
    inputs: [
      { name: "modules", type: "address[]", internalType: "address[]" },
      { name: "states", type: "uint8[]", internalType: "enum ModuleState[]" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "event",
    name: "Collect",
    inputs: [
      { name: "to", type: "address", indexed: true, internalType: "address" },
      {
        name: "token",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "Create",
    inputs: [
      {
        name: "asset",
        type: "address",
        indexed: false,
        internalType: "address"
      },
      {
        name: "numeraire",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "initializer",
        type: "address",
        indexed: false,
        internalType: "address"
      },
      {
        name: "poolOrHook",
        type: "address",
        indexed: false,
        internalType: "address"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "Migrate",
    inputs: [
      {
        name: "asset",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      { name: "pool", type: "address", indexed: true, internalType: "address" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "SetModuleState",
    inputs: [
      {
        name: "module",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "state",
        type: "uint8",
        indexed: true,
        internalType: "enum ModuleState"
      }
    ],
    anonymous: false
  },
  { type: "error", name: "ArrayLengthsMismatch", inputs: [] },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [{ name: "owner", type: "address", internalType: "address" }]
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [{ name: "account", type: "address", internalType: "address" }]
  },
  {
    type: "error",
    name: "WrongModuleState",
    inputs: [
      { name: "module", type: "address", internalType: "address" },
      { name: "expected", type: "uint8", internalType: "enum ModuleState" },
      { name: "actual", type: "uint8", internalType: "enum ModuleState" }
    ]
  }
];
var derc20Abi = [
  {
    type: "constructor",
    inputs: [
      { name: "name_", type: "string", internalType: "string" },
      { name: "symbol_", type: "string", internalType: "string" },
      { name: "initialSupply", type: "uint256", internalType: "uint256" },
      { name: "recipient", type: "address", internalType: "address" },
      { name: "owner_", type: "address", internalType: "address" },
      { name: "yearlyMintCap_", type: "uint256", internalType: "uint256" },
      { name: "vestingDuration_", type: "uint256", internalType: "uint256" },
      { name: "recipients_", type: "address[]", internalType: "address[]" },
      { name: "amounts_", type: "uint256[]", internalType: "uint256[]" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "CLOCK_MODE",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "DOMAIN_SEPARATOR",
    inputs: [],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" }
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "checkpoints",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "pos", type: "uint32", internalType: "uint32" }
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct Checkpoints.Checkpoint208",
        components: [
          { name: "_key", type: "uint48", internalType: "uint48" },
          { name: "_value", type: "uint208", internalType: "uint208" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "clock",
    inputs: [],
    outputs: [{ name: "", type: "uint48", internalType: "uint48" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "currentAnnualMint",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "currentYearStart",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "delegate",
    inputs: [{ name: "delegatee", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "delegateBySig",
    inputs: [
      { name: "delegatee", type: "address", internalType: "address" },
      { name: "nonce", type: "uint256", internalType: "uint256" },
      { name: "expiry", type: "uint256", internalType: "uint256" },
      { name: "v", type: "uint8", internalType: "uint8" },
      { name: "r", type: "bytes32", internalType: "bytes32" },
      { name: "s", type: "bytes32", internalType: "bytes32" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "delegates",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "eip712Domain",
    inputs: [],
    outputs: [
      { name: "fields", type: "bytes1", internalType: "bytes1" },
      { name: "name", type: "string", internalType: "string" },
      { name: "version", type: "string", internalType: "string" },
      { name: "chainId", type: "uint256", internalType: "uint256" },
      { name: "verifyingContract", type: "address", internalType: "address" },
      { name: "salt", type: "bytes32", internalType: "bytes32" },
      { name: "extensions", type: "uint256[]", internalType: "uint256[]" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getPastTotalSupply",
    inputs: [{ name: "timepoint", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getPastVotes",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "timepoint", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getVestingDataOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [
      { name: "totalAmount", type: "uint256", internalType: "uint256" },
      { name: "releasedAmount", type: "uint256", internalType: "uint256" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getVotes",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "isPoolUnlocked",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "lockPool",
    inputs: [{ name: "pool_", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "mintStartDate",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "nonces",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "numCheckpoints",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint32", internalType: "uint32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "permit",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
      { name: "deadline", type: "uint256", internalType: "uint256" },
      { name: "v", type: "uint8", internalType: "uint8" },
      { name: "r", type: "bytes32", internalType: "bytes32" },
      { name: "s", type: "bytes32", internalType: "bytes32" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "pool",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "release",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address", internalType: "address" },
      { name: "to", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "unlockPool",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "vestingDuration",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "vestingStart",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "yearlyMintCap",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "spender",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "value",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "DelegateChanged",
    inputs: [
      {
        name: "delegator",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "fromDelegate",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "toDelegate",
        type: "address",
        indexed: true,
        internalType: "address"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "DelegateVotesChanged",
    inputs: [
      {
        name: "delegate",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "previousVotes",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      },
      {
        name: "newVotes",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      }
    ],
    anonymous: false
  },
  { type: "event", name: "EIP712DomainChanged", inputs: [], anonymous: false },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true, internalType: "address" },
      { name: "to", type: "address", indexed: true, internalType: "address" },
      {
        name: "value",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      }
    ],
    anonymous: false
  },
  { type: "error", name: "ArrayLengthsMismatch", inputs: [] },
  { type: "error", name: "CheckpointUnorderedInsertion", inputs: [] },
  { type: "error", name: "ECDSAInvalidSignature", inputs: [] },
  {
    type: "error",
    name: "ECDSAInvalidSignatureLength",
    inputs: [{ name: "length", type: "uint256", internalType: "uint256" }]
  },
  {
    type: "error",
    name: "ECDSAInvalidSignatureS",
    inputs: [{ name: "s", type: "bytes32", internalType: "bytes32" }]
  },
  {
    type: "error",
    name: "ERC20ExceededSafeSupply",
    inputs: [
      { name: "increasedSupply", type: "uint256", internalType: "uint256" },
      { name: "cap", type: "uint256", internalType: "uint256" }
    ]
  },
  {
    type: "error",
    name: "ERC20InsufficientAllowance",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "allowance", type: "uint256", internalType: "uint256" },
      { name: "needed", type: "uint256", internalType: "uint256" }
    ]
  },
  {
    type: "error",
    name: "ERC20InsufficientBalance",
    inputs: [
      { name: "sender", type: "address", internalType: "address" },
      { name: "balance", type: "uint256", internalType: "uint256" },
      { name: "needed", type: "uint256", internalType: "uint256" }
    ]
  },
  {
    type: "error",
    name: "ERC20InvalidApprover",
    inputs: [{ name: "approver", type: "address", internalType: "address" }]
  },
  {
    type: "error",
    name: "ERC20InvalidReceiver",
    inputs: [{ name: "receiver", type: "address", internalType: "address" }]
  },
  {
    type: "error",
    name: "ERC20InvalidSender",
    inputs: [{ name: "sender", type: "address", internalType: "address" }]
  },
  {
    type: "error",
    name: "ERC20InvalidSpender",
    inputs: [{ name: "spender", type: "address", internalType: "address" }]
  },
  {
    type: "error",
    name: "ERC2612ExpiredSignature",
    inputs: [{ name: "deadline", type: "uint256", internalType: "uint256" }]
  },
  {
    type: "error",
    name: "ERC2612InvalidSigner",
    inputs: [
      { name: "signer", type: "address", internalType: "address" },
      { name: "owner", type: "address", internalType: "address" }
    ]
  },
  {
    type: "error",
    name: "ERC5805FutureLookup",
    inputs: [
      { name: "timepoint", type: "uint256", internalType: "uint256" },
      { name: "clock", type: "uint48", internalType: "uint48" }
    ]
  },
  { type: "error", name: "ERC6372InconsistentClock", inputs: [] },
  { type: "error", name: "ExceedsYearlyMintCap", inputs: [] },
  {
    type: "error",
    name: "InvalidAccountNonce",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "currentNonce", type: "uint256", internalType: "uint256" }
    ]
  },
  { type: "error", name: "InvalidShortString", inputs: [] },
  {
    type: "error",
    name: "MaxPreMintPerAddressExceeded",
    inputs: [
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "limit", type: "uint256", internalType: "uint256" }
    ]
  },
  {
    type: "error",
    name: "MaxTotalPreMintExceeded",
    inputs: [
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "limit", type: "uint256", internalType: "uint256" }
    ]
  },
  { type: "error", name: "MintingNotStartedYet", inputs: [] },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [{ name: "owner", type: "address", internalType: "address" }]
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [{ name: "account", type: "address", internalType: "address" }]
  },
  { type: "error", name: "PoolLocked", inputs: [] },
  { type: "error", name: "ReleaseAmountInvalid", inputs: [] },
  {
    type: "error",
    name: "SafeCastOverflowedUintDowncast",
    inputs: [
      { name: "bits", type: "uint8", internalType: "uint8" },
      { name: "value", type: "uint256", internalType: "uint256" }
    ]
  },
  {
    type: "error",
    name: "StringTooLong",
    inputs: [{ name: "str", type: "string", internalType: "string" }]
  },
  {
    type: "error",
    name: "VotesExpiredSignature",
    inputs: [{ name: "expiry", type: "uint256", internalType: "uint256" }]
  }
];
var dopplerAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_poolManager",
        type: "address",
        internalType: "contract IPoolManager"
      },
      { name: "_numTokensToSell", type: "uint256", internalType: "uint256" },
      { name: "_minimumProceeds", type: "uint256", internalType: "uint256" },
      { name: "_maximumProceeds", type: "uint256", internalType: "uint256" },
      { name: "_startingTime", type: "uint256", internalType: "uint256" },
      { name: "_endingTime", type: "uint256", internalType: "uint256" },
      { name: "_startingTick", type: "int24", internalType: "int24" },
      { name: "_endingTick", type: "int24", internalType: "int24" },
      { name: "_epochLength", type: "uint256", internalType: "uint256" },
      { name: "_gamma", type: "int24", internalType: "int24" },
      { name: "_isToken0", type: "bool", internalType: "bool" },
      { name: "_numPDSlugs", type: "uint256", internalType: "uint256" },
      { name: "initializer_", type: "address", internalType: "address" }
    ],
    stateMutability: "nonpayable"
  },
  { type: "receive", stateMutability: "payable" },
  {
    type: "function",
    name: "afterAddLiquidity",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      {
        name: "",
        type: "tuple",
        internalType: "struct IPoolManager.ModifyLiquidityParams",
        components: [
          { name: "tickLower", type: "int24", internalType: "int24" },
          { name: "tickUpper", type: "int24", internalType: "int24" },
          { name: "liquidityDelta", type: "int256", internalType: "int256" },
          { name: "salt", type: "bytes32", internalType: "bytes32" }
        ]
      },
      { name: "", type: "int256", internalType: "BalanceDelta" },
      { name: "", type: "int256", internalType: "BalanceDelta" },
      { name: "", type: "bytes", internalType: "bytes" }
    ],
    outputs: [
      { name: "", type: "bytes4", internalType: "bytes4" },
      { name: "", type: "int256", internalType: "BalanceDelta" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "afterDonate",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "", type: "uint256", internalType: "uint256" },
      { name: "", type: "uint256", internalType: "uint256" },
      { name: "", type: "bytes", internalType: "bytes" }
    ],
    outputs: [{ name: "", type: "bytes4", internalType: "bytes4" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "afterInitialize",
    inputs: [
      { name: "sender", type: "address", internalType: "address" },
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "", type: "uint160", internalType: "uint160" },
      { name: "tick", type: "int24", internalType: "int24" }
    ],
    outputs: [{ name: "", type: "bytes4", internalType: "bytes4" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "afterRemoveLiquidity",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      {
        name: "",
        type: "tuple",
        internalType: "struct IPoolManager.ModifyLiquidityParams",
        components: [
          { name: "tickLower", type: "int24", internalType: "int24" },
          { name: "tickUpper", type: "int24", internalType: "int24" },
          { name: "liquidityDelta", type: "int256", internalType: "int256" },
          { name: "salt", type: "bytes32", internalType: "bytes32" }
        ]
      },
      { name: "", type: "int256", internalType: "BalanceDelta" },
      { name: "", type: "int256", internalType: "BalanceDelta" },
      { name: "", type: "bytes", internalType: "bytes" }
    ],
    outputs: [
      { name: "", type: "bytes4", internalType: "bytes4" },
      { name: "", type: "int256", internalType: "BalanceDelta" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "afterSwap",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      {
        name: "swapParams",
        type: "tuple",
        internalType: "struct IPoolManager.SwapParams",
        components: [
          { name: "zeroForOne", type: "bool", internalType: "bool" },
          { name: "amountSpecified", type: "int256", internalType: "int256" },
          {
            name: "sqrtPriceLimitX96",
            type: "uint160",
            internalType: "uint160"
          }
        ]
      },
      { name: "swapDelta", type: "int256", internalType: "BalanceDelta" },
      { name: "", type: "bytes", internalType: "bytes" }
    ],
    outputs: [
      { name: "", type: "bytes4", internalType: "bytes4" },
      { name: "", type: "int128", internalType: "int128" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "beforeAddLiquidity",
    inputs: [
      { name: "caller", type: "address", internalType: "address" },
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      {
        name: "",
        type: "tuple",
        internalType: "struct IPoolManager.ModifyLiquidityParams",
        components: [
          { name: "tickLower", type: "int24", internalType: "int24" },
          { name: "tickUpper", type: "int24", internalType: "int24" },
          { name: "liquidityDelta", type: "int256", internalType: "int256" },
          { name: "salt", type: "bytes32", internalType: "bytes32" }
        ]
      },
      { name: "", type: "bytes", internalType: "bytes" }
    ],
    outputs: [{ name: "", type: "bytes4", internalType: "bytes4" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "beforeDonate",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "", type: "uint256", internalType: "uint256" },
      { name: "", type: "uint256", internalType: "uint256" },
      { name: "", type: "bytes", internalType: "bytes" }
    ],
    outputs: [{ name: "", type: "bytes4", internalType: "bytes4" }],
    stateMutability: "pure"
  },
  {
    type: "function",
    name: "beforeInitialize",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      { name: "", type: "uint160", internalType: "uint160" }
    ],
    outputs: [{ name: "", type: "bytes4", internalType: "bytes4" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "beforeRemoveLiquidity",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      {
        name: "",
        type: "tuple",
        internalType: "struct IPoolManager.ModifyLiquidityParams",
        components: [
          { name: "tickLower", type: "int24", internalType: "int24" },
          { name: "tickUpper", type: "int24", internalType: "int24" },
          { name: "liquidityDelta", type: "int256", internalType: "int256" },
          { name: "salt", type: "bytes32", internalType: "bytes32" }
        ]
      },
      { name: "", type: "bytes", internalType: "bytes" }
    ],
    outputs: [{ name: "", type: "bytes4", internalType: "bytes4" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "beforeSwap",
    inputs: [
      { name: "", type: "address", internalType: "address" },
      {
        name: "key",
        type: "tuple",
        internalType: "struct PoolKey",
        components: [
          { name: "currency0", type: "address", internalType: "Currency" },
          { name: "currency1", type: "address", internalType: "Currency" },
          { name: "fee", type: "uint24", internalType: "uint24" },
          { name: "tickSpacing", type: "int24", internalType: "int24" },
          { name: "hooks", type: "address", internalType: "contract IHooks" }
        ]
      },
      {
        name: "swapParams",
        type: "tuple",
        internalType: "struct IPoolManager.SwapParams",
        components: [
          { name: "zeroForOne", type: "bool", internalType: "bool" },
          { name: "amountSpecified", type: "int256", internalType: "int256" },
          {
            name: "sqrtPriceLimitX96",
            type: "uint160",
            internalType: "uint160"
          }
        ]
      },
      { name: "", type: "bytes", internalType: "bytes" }
    ],
    outputs: [
      { name: "", type: "bytes4", internalType: "bytes4" },
      { name: "", type: "int256", internalType: "BeforeSwapDelta" },
      { name: "", type: "uint24", internalType: "uint24" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "earlyExit",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getHookPermissions",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct Hooks.Permissions",
        components: [
          { name: "beforeInitialize", type: "bool", internalType: "bool" },
          { name: "afterInitialize", type: "bool", internalType: "bool" },
          { name: "beforeAddLiquidity", type: "bool", internalType: "bool" },
          { name: "afterAddLiquidity", type: "bool", internalType: "bool" },
          { name: "beforeRemoveLiquidity", type: "bool", internalType: "bool" },
          { name: "afterRemoveLiquidity", type: "bool", internalType: "bool" },
          { name: "beforeSwap", type: "bool", internalType: "bool" },
          { name: "afterSwap", type: "bool", internalType: "bool" },
          { name: "beforeDonate", type: "bool", internalType: "bool" },
          { name: "afterDonate", type: "bool", internalType: "bool" },
          { name: "beforeSwapReturnDelta", type: "bool", internalType: "bool" },
          { name: "afterSwapReturnDelta", type: "bool", internalType: "bool" },
          {
            name: "afterAddLiquidityReturnDelta",
            type: "bool",
            internalType: "bool"
          },
          {
            name: "afterRemoveLiquidityReturnDelta",
            type: "bool",
            internalType: "bool"
          }
        ]
      }
    ],
    stateMutability: "pure"
  },
  {
    type: "function",
    name: "initializer",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "insufficientProceeds",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "isInitialized",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "migrate",
    inputs: [{ name: "recipient", type: "address", internalType: "address" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160", internalType: "uint160" },
      { name: "token0", type: "address", internalType: "address" },
      { name: "fees0", type: "uint128", internalType: "uint128" },
      { name: "balance0", type: "uint128", internalType: "uint128" },
      { name: "token1", type: "address", internalType: "address" },
      { name: "fees1", type: "uint128", internalType: "uint128" },
      { name: "balance1", type: "uint128", internalType: "uint128" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "poolKey",
    inputs: [],
    outputs: [
      { name: "currency0", type: "address", internalType: "Currency" },
      { name: "currency1", type: "address", internalType: "Currency" },
      { name: "fee", type: "uint24", internalType: "uint24" },
      { name: "tickSpacing", type: "int24", internalType: "int24" },
      { name: "hooks", type: "address", internalType: "contract IHooks" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "poolManager",
    inputs: [],
    outputs: [
      { name: "", type: "address", internalType: "contract IPoolManager" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "positions",
    inputs: [{ name: "salt", type: "bytes32", internalType: "bytes32" }],
    outputs: [
      { name: "tickLower", type: "int24", internalType: "int24" },
      { name: "tickUpper", type: "int24", internalType: "int24" },
      { name: "liquidity", type: "uint128", internalType: "uint128" },
      { name: "salt", type: "uint8", internalType: "uint8" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "state",
    inputs: [],
    outputs: [
      { name: "lastEpoch", type: "uint40", internalType: "uint40" },
      { name: "tickAccumulator", type: "int256", internalType: "int256" },
      { name: "totalTokensSold", type: "uint256", internalType: "uint256" },
      { name: "totalProceeds", type: "uint256", internalType: "uint256" },
      {
        name: "totalTokensSoldLastEpoch",
        type: "uint256",
        internalType: "uint256"
      },
      { name: "feesAccrued", type: "int256", internalType: "BalanceDelta" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "unlockCallback",
    inputs: [{ name: "data", type: "bytes", internalType: "bytes" }],
    outputs: [{ name: "", type: "bytes", internalType: "bytes" }],
    stateMutability: "nonpayable"
  },
  {
    type: "event",
    name: "EarlyExit",
    inputs: [
      {
        name: "epoch",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      }
    ],
    anonymous: false
  },
  { type: "event", name: "InsufficientProceeds", inputs: [], anonymous: false },
  {
    type: "event",
    name: "Rebalance",
    inputs: [
      {
        name: "currentTick",
        type: "int24",
        indexed: false,
        internalType: "int24"
      },
      {
        name: "tickLower",
        type: "int24",
        indexed: false,
        internalType: "int24"
      },
      {
        name: "tickUpper",
        type: "int24",
        indexed: false,
        internalType: "int24"
      },
      {
        name: "epoch",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "Swap",
    inputs: [
      {
        name: "currentTick",
        type: "int24",
        indexed: false,
        internalType: "int24"
      },
      {
        name: "totalProceeds",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      },
      {
        name: "totalTokensSold",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      }
    ],
    anonymous: false
  },
  { type: "error", name: "AlreadyInitialized", inputs: [] },
  { type: "error", name: "CannotAddLiquidity", inputs: [] },
  { type: "error", name: "CannotDonate", inputs: [] },
  { type: "error", name: "CannotMigrate", inputs: [] },
  { type: "error", name: "CannotSwapBeforeStartTime", inputs: [] },
  { type: "error", name: "HookNotImplemented", inputs: [] },
  { type: "error", name: "InvalidEpochLength", inputs: [] },
  { type: "error", name: "InvalidGamma", inputs: [] },
  { type: "error", name: "InvalidNumPDSlugs", inputs: [] },
  { type: "error", name: "InvalidPool", inputs: [] },
  { type: "error", name: "InvalidProceedLimits", inputs: [] },
  { type: "error", name: "InvalidStartTime", inputs: [] },
  {
    type: "error",
    name: "InvalidSwapAfterMaturityInsufficientProceeds",
    inputs: []
  },
  {
    type: "error",
    name: "InvalidSwapAfterMaturitySufficientProceeds",
    inputs: []
  },
  { type: "error", name: "InvalidTickRange", inputs: [] },
  { type: "error", name: "InvalidTickSpacing", inputs: [] },
  { type: "error", name: "InvalidTimeRange", inputs: [] },
  { type: "error", name: "LockFailure", inputs: [] },
  { type: "error", name: "MaximumProceedsReached", inputs: [] },
  { type: "error", name: "NotPoolManager", inputs: [] },
  { type: "error", name: "NotSelf", inputs: [] },
  { type: "error", name: "SenderNotInitializer", inputs: [] },
  { type: "error", name: "SenderNotPoolManager", inputs: [] },
  { type: "error", name: "SwapBelowRange", inputs: [] }
];

// src/abis/bytecodes.ts
var DopplerBytecode = "0x60a06040523461053a57604051601f6153be38819003918201601f19168301916001600160401b0383118484101761053e578084926101a09460405283398101031261053a578051906001600160a01b038216820361053a5760208101516040820151906060830151608084015160a08501519061007f60c08701610572565b9161008c60e08801610572565b91610100880151946100a16101208a01610572565b976101408a01519788158015998a810361053a576101608d0151610180909d01516001600160a01b0381169e908f0361053a576080525f6101a06100e3610552565b8281528260208201528260408201528260608201528260808201528260a08201528260c08201528260e0820152826101008201528261012082015282610140820152826101608201528261018082015201525f6101a0610141610552565b6001815260016020820152600160408201528260608201528260808201528260a0820152600160c0820152600160e0820152600161010082015282610120820152826101408201528261016082015282610180820152015261200030161515600114801590610529575b8015610518575b801561050b575b80156104fe575b80156104f1575b80156104e1575b80156104d1575b80156104c1575b80156104b5575b80156104a9575b801561049d575b8015610491575b8015610485575b61047257854211610463578760020b908960020b90828203610423575b505050508484101561041457838503858111610400578a60020b5f81138015906103e6575b6103d75789156103c3578982066103b4578c156103a657600a8d116103a6578484116103975761027a610283928b81046016558b610580565b80601755610617565b6280000081101561038a5762ffffff19601854169062ffffff1617601855600d55600e55600f5560105560115562ffffff6012549160181b65ffffff0000001692169065ffffffffffff1916171760125560135562ffffff63ff0000006014549260181b1692169063ffffffff1916171760145560155560018060a01b0319600c541617600c55604051614d2b90816106938239608051818181601c015281816101a601528181610351015281816103e4015281816107f501528181610b7601528181610c0101528181610d2b01528181610e110152818161148301528181612a51015281816134a3015281816135440152818161389d01528181613fb7015261405e0152f35b6335278d125f526004601cfd5b638cc99b7b60e01b5f5260045ffd5b6287e39960e61b5f5260045ffd5b6388ac089760e01b5f5260045ffd5b634e487b7160e01b5f52601260045260245ffd5b6312469eb560e11b5f5260045ffd5b506103fa816103f5848d610580565b610617565b15610241565b634e487b7160e01b5f52601160045260245ffd5b63536a71af60e01b5f5260045ffd5b8061045a575b6104425782610450575b5050610442575f80808061021c565b6264847d60e41b5f5260045ffd5b1390505f80610433565b50818112610429565b632ca4094f60e21b5f5260045ffd5b630732d7b560e51b5f523060045260245ffd5b506001301615156101ff565b506002301615156101f8565b506004301615156101f1565b506008301615156101ea565b506010301615156101e3565b50602030161515600114156101dc565b50604030161515600114156101d5565b50608030161515600114156101ce565b50610100301615156101c7565b50610200301615156101c0565b50610400301615156101b9565b5061080030161515600114156101b2565b5061100030161515600114156101ab565b5f80fd5b634e487b7160e01b5f52604160045260245ffd5b604051906101c082016001600160401b0381118382101761053e57604052565b51908160020b820361053a57565b90670de0b6b3a76400008202905f19670de0b6b3a764000084099282808510940393808503948584111561053a571461061057670de0b6b3a764000082910981805f03168092046002816003021880820260020302808202600203028082026002030280820260020302808202600203028091026002030293600183805f03040190848311900302920304170290565b5091500490565b808202905f1983820990828083109203918083039283670de0b6b3a7640000111561053a5714610681577faccb18165bd6fe31ae1cf318dc5b51eee0e1ba569b88cd74c1773b91fac1066993670de0b6b3a7640000910990828211900360ee1b910360121c170290565b5050670de0b6b3a76400009150049056fe608080604052600436101561005b575b50361561001a575f80fd5b7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316330361004c57005b6393c866c160e01b5f5260045ffd5b5f3560e01c908163182148ef14610e955750806321d0ee7014610e73578063259982e514610dfe578063392e53cd14610ddc578063514ea4bf14610d87578063575e24b414610cd45780636c2bbe7e14610b165780636fe7e6eb14610bc157806391dd734614610b435780639ce110d714610b1b5780639f063efc14610b16578063a4dee15514610af2578063b47b2fb11461079b578063b6a8b0fa14610778578063c19d93fb1461072a578063c4e833ce146105bf578063ce5494bb146103a1578063d0c52e2114610380578063dc4c90d31461033c578063dc98354e146101755763e1b4af691461014e575f61000f565b346101715761015c36611064565b505050505050630a85dc2960e01b5f5260045ffd5b5f80fd5b346101715760e03660031901126101715761018e610eeb565b5060a0366023190112610171576101a3611016565b507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316330361032d5760085460ff811661031f5760ff19166001176008556001600160a01b03602435908116908181036101715750600980546001600160a01b0319169190911790556044356001600160a01b038116908181036101715750600a80546001600160a01b03191691909117905560643562ffffff8116810361017157600a5461025861138d565b60b81b62ffffff60b81b169162ffffff60a01b9060a01b169065ffffffffffff60a01b19161717600a5560a43560018060a01b03811680910361017157600b80546001600160a01b031916919091179055601e6102b361138d565b60020b136103105760145460020b6102c961138d565b60020b9081156102fc570760020b6102ed57604051636e4c1aa760e11b8152602090f35b6312469eb560e11b5f5260045ffd5b634e487b7160e01b5f52601260045260245ffd5b63013840ad60e51b5f5260045ffd5b62dc149f60e41b5f5260045ffd5b63570c108560e11b5f5260045ffd5b34610171575f366003190112610171576040517f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168152602090f35b34610171575f36600319011261017157602060ff5f54166040519015158152f35b34610171576020366003190112610171576103ba610eeb565b600c546001600160a01b031633036105b05760ff5f5460081c16158061058f575b610580576104737f0000000000000000000000000000000000000000000000000000000000000000915f61044b610459604051610417816110bb565b61041f6127b0565b815260018060a01b038516602082015283604082015260016060820152604051928391602083016126e7565b03601f19810183528261113c565b604051809481926348c8949160e01b83526004830161103a565b0381836001600160a01b0388165af180156105755760e0936104ad6104f9926104e8955f91610553575b50602080825183010191016127fd565b60095490959194906104d2906001600160a01b0316826104cc82614503565b91614574565b600a546001600160a01b0316906104cc82614503565b60a06104f26127b0565b2090612860565b5050600954600a54604080516001600160a01b03958616815292851660208401526001600160801b03608088811d82169285019290925286821d81166060850152949091169082015293821660a0850152501660c0820152f35b61056f91503d805f833e610567818361113c565b810190612728565b8761049d565b6040513d5f823e3d90fd5b63051a2a5560e51b5f5260045ffd5b50600454600e541115806105a4575b156103db565b5060115442101561059e565b638341a67960e01b5f5260045ffd5b34610171575f366003190112610171575f6101a06040516105df816110ea565b8281528260208201528260408201528260608201528260808201528260a08201528260c08201528260e0820152826101008201528261012082015282610140820152826101608201528261018082015201526101c06020604051610642816110ea565b6001815281810190600182526040810160018152606082015f8152608083015f815260a084015f815260c085016001815260e086019060018252610100870192600184526101208801945f86526101408901965f88526101608a01985f8a526101a06101808c019b5f8d52019b5f8d526040519d8e916001835251151591015251151560408d015251151560608c015251151560808b015251151560a08a015251151560c089015251151560e08801525115156101008701525115156101208601525115156101408501525115156101608401525115156101808301525115156101a0820152f35b34610171575f3660031901126101715760c064ffffffffff600154166002546003546004546005549160065493604051958652602086015260408501526060840152608083015260a0820152f35b346101715761078636611064565b50505050505063567d91d160e01b5f5260045ffd5b3461017157610160366003190112610171576107b5610eeb565b5060a03660231901126101715760603660c31901126101715761012435610144356001600160401b038111610171576107f2903690600401610f15565b507f000000000000000000000000000000000000000000000000000000000000000090506001600160a01b038116330361032d576108359060a06104f23661115f565b909193925060015f52600760205260405f205460020b9160c4359081151582036101715762ffffff91610fff91829115610ae957165b169116620f4240818302049101039060ff60145460181c165f14610a35578360020b12610a2657608082901d5f600f82900b126109e1576003546108b8916001600160801b03169061127b565b6003555b600f82900b5f81126109735750505f80516020614cdf833981519152916108ef60609260018060801b0316600454611260565b6004555b600454600f5481101561092f575b600354906040519260020b835260208301526040820152a16040805163b47b2fb160e01b81525f6020820152f35b61010061ff00195f5416175f557f628a470bfdde264ef77cd19acfbfca22b3e4413adaf5837ec9fbc0043e35793f602061096761281d565b604051908152a1610901565b62ffffff91925061098390612799565b9116620f42400391620f424083116109cd575f80516020614cdf833981519152926060926109c5916109bd916001600160801b0316614239565b60045461127b565b6004556108f3565b634e487b7160e01b5f52601160045260245ffd5b6109ea90612799565b62ffffff8216620f42400390620f424082116109cd57610a1e91610a16916001600160801b0316614239565b600354611260565b6003556108bc565b637de7c0cb60e11b5f5260045ffd5b8360029392930b13610a2657600f81900b5f8112610aac5750600354610a65906001600160801b0383169061127b565b6003555b60801d905f600f83900b12610a9e57505f80516020614cdf833981519152916109c560609260018060801b0316600454611260565b9061098362ffffff91612799565b610ab590612799565b62ffffff8316620f42400390620f424082116109cd57610ae191610a16916001600160801b0316614239565b600355610a69565b600c1c1661086b565b34610171575f36600319011261017157602060ff5f5460081c166040519015158152f35b610fa5565b34610171575f36600319011261017157600c546040516001600160a01b039091168152602090f35b34610171576020366003190112610171576004356001600160401b03811161017157610b73903690600401610f15565b907f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316330361032d57610bbd91610bb1916139a1565b6040519182918261103a565b0390f35b346101715761010036600319011261017157610bdb610eeb565b60a036602319011261017157610bef611016565b5060e435908160020b809203610171577f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316913383900361032d575f9261044b610c7f8594610c9b9460405191610c4d836110bb565b610c563661115f565b835260018060a01b031660208301526040820152856060820152604051928391602083016126e7565b6040519485809481936348c8949160e01b83526004830161103a565b03925af1801561057557610cbc575b604051636fe7e6eb60e01b8152602090f35b610ccf903d805f833e610567818361113c565b610caa565b346101715761014036600319011261017157610cee610eeb565b5060a03660231901126101715760603660c319011261017157610124356001600160401b03811161017157610d27903690600401610f15565b50507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316330361032d57606062ffffff610d676113ce565b906040939293519363ffffffff60e01b1684526020840152166040820152f35b34610171576020366003190112610171576004355f526007602052608060405f205460ff604051918060020b83528060181c60020b6020840152600180851b038160301c16604084015260b01c166060820152f35b34610171575f36600319011261017157602060ff600854166040519015158152f35b3461017157610e0c36610f42565b5050507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03163303905061032d57306001600160a01b0390911603610e645760405163259982e560e01b8152602090f35b636d1ed89b60e01b5f5260045ffd5b3461017157610e8136610f42565b5050505050630a85dc2960e01b5f5260045ffd5b34610171575f36600319011261017157600954600a54600b546001600160a01b039283168452818316602085015260a082811c62ffffff16604086015260b89290921c60020b6060850152909116608083015290f35b600435906001600160a01b038216820361017157565b35906001600160a01b038216820361017157565b9181601f84011215610171578235916001600160401b038311610171576020838186019501011161017157565b90610160600319830112610171576004356001600160a01b0381168103610171579160a060231982011261017157602491608060c3198301126101715760c49161014435906001600160401b03821161017157610fa191600401610f15565b9091565b34610171576101a0366003190112610171576004356001600160a01b0381168103610171575060a03660231901126101715760803660c319011261017157610184356001600160401b03811161017157611003903690600401610f15565b5050630a85dc2960e01b5f908152600490fd5b60c435906001600160a01b038216820361017157565b35908160020b820361017157565b602060409281835280519182918282860152018484015e5f828201840152601f01601f1916010190565b610120600319820112610171576004356001600160a01b0381168103610171579160a06023198301126101715760249160c4359160e4359161010435906001600160401b03821161017157610fa191600401610f15565b608081019081106001600160401b038211176110d657604052565b634e487b7160e01b5f52604160045260245ffd5b6101c081019081106001600160401b038211176110d657604052565b60a081019081106001600160401b038211176110d657604052565b606081019081106001600160401b038211176110d657604052565b601f909101601f19168101906001600160401b038211908210176110d657604052565b60a0906023190112610171576040519061117882611106565b816024356001600160a01b03811681036101715781526044356001600160a01b038116810361017157602082015260643562ffffff811681036101715760408201526084358060020b810361017157606082015260a435906001600160a01b03821682036101715760800152565b91908260a0910312610171576040516111fe81611106565b809261120981610f01565b825261121760208201610f01565b602083015260408101359062ffffff821682036101715760809160408401526112426060820161102c565b60608401520135906001600160a01b03821682036101715760800152565b919082039182116109cd57565b60020190816002116109cd57565b919082018092116109cd57565b6001600160401b0381116110d65760051b60200190565b906112a982611288565b6112b6604051918261113c565b82815280926112c7601f1991611288565b01905f5b8281106112d757505050565b6020906040516112e6816110bb565b5f81525f838201525f60408201525f6060820152828285010152016112cb565b8051156113135760200190565b634e487b7160e01b5f52603260045260245ffd5b8051600110156113135760400190565b80518210156113135760209160051b010190565b90604051611358816110bb565b9154600281810b8452601882901c900b6020840152603081901c6001600160801b0316604084015260b01c60ff166060830152565b6084358060020b81036101715790565b60020b627fffff1981146109cd575f0390565b9060020b9060020b0190627fffff198212627fffff8313176109cd57565b5f805460ff8160081c16612695576010544210612686576113ed61281d565b64ffffffffff600154161015612675576011544210158061266a575b612332575b505f5460ff166122dc5761142061281d565b916001549161143664ffffffffff841685611260565b64ffffffffff1990931664ffffffffff85161760015560035460025f5260076020529161146f5f80516020614cff83398151915261134b565b906114a760a06114803660246111e6565b207f0000000000000000000000000000000000000000000000000000000000000000612860565b5091965f94925081600182116120a4575b50506114c261281d565b858112801516611f22576115126114f36114ea6114e161151b946138fb565b60135490613948565b60105490613986565b61150c6115036010548093611260565b91601154611260565b906142a5565b600d549061433c565b90856115296005548961390c565b600589905513611ec357505061154f61157c915160020b9361154961478c565b90613986565b925b611576670de0b6b3a764000061156986600254613986565b9580611eba575b05614820565b906113b0565b608435908160020b8203611eb6578161159491612f90565b966115c0826115bb6115b0670de0b6b3a76400005f9805614820565b60125460020b6113b0565b612f90565b9160145460ff8160181c165f14611ea3576115de9060020b846113b0565b905b83958a60020b948060020b8614611e61575b5050506115fe8961303a565b976116088661303a565b8815611e5a5760145460181c60ff1615611da85760016116298a8c84614c05565b91818060a01b038c1690828060a01b0316038060ff1d9081011891818060801b031661165583826143b7565b928260601b9109151516015b6015546116756116708261126d565b61129f565b9060018a52600760205261168b60408b2061134b565b61169483611306565b5261169e82611306565b5060028a5260076020526116b460408b2061134b565b6116bd83611327565b526116c782611327565b50895b818110611d605750506116e8906116e23660246111e6565b90612967565b9060ff60145460181c16805f14611d06576001600160801b038316926024356001600160a01b0381168103611d025761174f9161173a9161172890614503565b9060801d6001600160801b031661127b565b60065460801d6001600160801b031690611260565b9c5b61175c3660246111e6565b92611765612b20565b9285821115611cbe575050505061177d918a91612b5b565b995b60408b0180519099906001600160801b031615611caf575b6118b66118a46117a83660246111e6565b6117dd6117b3612b20565b946117d86115126114f36114ea6114e16117d36117ce61281d565b61396a565b6138fb565b61390c565b8c80821315611c9e575085811115611c95575061183f855b918d606060185460020b920191825160020b8082135f14611c8d5750905b508b875260145460181c60ff1615611c7d5761183390875160020b6113b0565b905b5160020b90612f90565b60020b60208501525b835160020b946020850195865160020b14155f14611c725760ff60145460181c166118998361187a885160020b61303a565b89516001600160801b039491906118939060020b61303a565b916146ea565b166040860152611260565b85836118b13660246111e6565b614860565b9b6118c561167060155461126d565b9a6020825160020b92015160020b9060018060801b0390511690604051926118ec846110bb565b835260208301526040820152600160608201526119088b611306565b526119128a611306565b50805160020b915160020b90604060018060801b03910151169060405192611939846110bb565b8352602083015260408201526002606082015261195589611327565b5261195f88611327565b50865b8a51811015611a13578a60206119878361197c8185611337565b515160020b93611337565b51015160020b8c60406119a18560018060801b0393611337565b510151168360030191826003116119ff579260ff6119f8938e9360019796604051946119cc866110bb565b8552602085015260408401521660608201526119f16119ea8561126d565b8093611337565b528b611337565b5001611962565b634e487b7160e01b8c52601160045260248cfd5b50611a32919293949598999699611a2b3660246111e6565b9189613399565b611a3b86611306565b5160018952600760209081526040808b2083518154938501519285015160609095015160189390931b65ffffff000000166001600160b81b031990941662ffffff909116179290921760309390931b600160301b600160b01b03169290921760b09290921b60ff60b01b16919091179055611ab586611327565b5160028952600760209081526040808b2083518154938501519285015160609095015160189390931b65ffffff000000166001600160b81b031990941662ffffff909116179290921760309390931b600160301b600160b01b03169290921760b09290921b60ff60b01b16919091179055875b601554811015611c1b5785518110611b72578060030180600311611b5e57906001918a5260076020528960408120555b01611b28565b634e487b7160e01b8a52601160045260248afd5b611b84611b7e8261126d565b88611337565b518160030180600311611c07578a52600760209081526040808c2083518154938501519285015160609095015160189390931b65ffffff000000166001600160b81b031990941662ffffff909116179290921760309390931b600160301b600160b01b03169290921760b09290921b60ff60b01b16919091179055600190611b58565b634e487b7160e01b8b52601160045260248bfd5b5090919296957f223157ec47d7bd04fa3ed10c0a8adb38faf97b51ec856a777425a2e39253bd7395506080945060405193845260020b602084015260020b60408301526060820152a15b6315d7892d60e21b918190565b8c6040860152611260565b611c87908c612b3e565b90611835565b905090611813565b61183f906117f5565b915050888452886020850152611848565b60208c015160020b8c52611797565b90919350829e9450886020611cf7948d60020b81520152611cde8b61303a565b6001600160801b0394611cf09061303a565b91156146ea565b1660408c015261177f565b8b80fd5b608083901d6001600160801b0316926044356001600160a01b0381168103611d0257611d5a91611d4891611d3990614503565b906001600160801b031661127b565b6006546001600160801b031690611260565b9c611751565b80600301806003116119ff57906001918c526007602052611da160408d20611d90611d8a8461126d565b9161134b565b611d9a8288611337565b5285611337565b50016116ca565b611db3898b83614bc2565b8a826001600160a01b0380831690821611611e4f575b506001600160a01b038316918215611e435760601b600160601b600160e01b0316926001600160a01b03828116929190910316611e07828286614483565b938215611e2f5709611e21575b8082061515910401611661565b906001019081611e14578880fd5b634e487b7160e01b8c52601260045260248cfd5b62bfc9218b526004601cfd5b8c935090505f611dc9565b5086611661565b6014549397929360181c60ff1615611e905750611e8c5790611e8291612b3e565b935b5f80806115f2565b8680fd5b9050611e9d9291506113b0565b93611e84565b611eb09060020b84612b3e565b906115e0565b8480fd5b86600255611570565b909391848711611f36575092611ee1611eda61478c565b91876142a5565b670de0b6b3a76400000390670de0b6b3a76400008211611f225791670de0b6b3a7640000611f15611f1c9361157c95613948565b0590613986565b92611551565b634e487b7160e01b86526011600452602486fd5b909350611f5860125460020b670de0b6b3a76400006002540560020b906113b0565b60185460020b94608435918260020b968784141597886120845781131561209a57925b6014549460ff8660181c1694855f1461208857611f9b915160020b6113b0565b80986120845790611fab91612f90565b93611fb88c601654611260565b91841561207257611fcc9160020b906113b0565b60155482101561205957506003018060031161204557611f1c9361157c959361154993612021938b52600760205260408b205460181c60020b915b15612030578160020b8160020b135f146120295750612b3e565b60020b613924565b9050612b3e565b8160020b8160020b125f146120295750612b3e565b634e487b7160e01b88526011600452602488fd5b61202191509361157c959361154993611f1c9691612007565b61207f9160020b90612b3e565b611fcc565b8980fd5b612095915160020b612b3e565b611f9b565b505f965082611f7b565b5f6120b5600597939497548a61390c565b1361210b57506120c79061154961478c565b905b6120d161478c565b60011982019182116120f7576120eb929161154991613948565b92856005555f806114b8565b634e487b7160e01b87526011600452602487fd5b5f198301908382116109cd5761212861212383613389565b61476c565b8911612183575061214c61214661212361214061478c565b93613389565b896142a5565b670de0b6b3a76400000390670de0b6b3a7640000821161204557611f1561217d9392670de0b6b3a764000092613948565b906120c9565b92965050506121a760125460020b670de0b6b3a76400006002540560020b906113b0565b9360185460020b608435958660020b91828814159283610171578113156122d257915b6014549760ff8960181c1693845f146122be576121eb90885160020b6113b0565b915b610171576121fa91612f90565b966122078c601654611260565b9183156122ac5761221b9160020b906113b0565b60155482101561229b575060030191826003116109cd5761226d93612021935f52600760205260405f205460181c60020b925b1561227b57508160020b8160020b135f1461227457505b945b85612b3e565b5f946120c9565b9050612265565b90508160020b8160020b125f1461229457505b94612267565b905061228e565b6120219391509361226d949261224e565b6122b99160020b90612b3e565b61221b565b6122cc90885160020b612b3e565b916121ed565b508691505f6121ca565b60145460181c60ff161561230d5760c43580159081158103610171575015611c655763016ccb0760e01b5f5260045ffd5b60c435801515808203610171576001915003611c655763016ccb0760e01b5f5260045ffd5b600454600e54111561265b5760019060ff1916175f557fe8775e4a58023f399765c3455b45eebcc45ad6b99607a1163f02e1318430970c5f80a161237c60a06114803660246111e6565b5050905060155461238f6116708261126d565b60015f526007602052906123c27fb39221ace053465ec3453ce2b36430bd138b997ecea25c1043da0c366812b82861134b565b6123cb83611306565b526123d582611306565b5060025f5260076020526123f55f80516020614cff83398151915261134b565b6123fe83611327565b5261240882611327565b505f5b81811061262a575050612423906116e23660246111e6565b61245860ff60145460181c1691825f1461262257600f0b5b600354906001600160801b03166124533660246111e6565b612b5b565b90604080519290612469818561113c565b60018452601f19015f5b8181106125f3575050805160020b6020820191825160020b90604060018060801b039101511690604051926124a7846110bb565b835260208301526040820152600160608201526124c384611306565b526124cd83611306565b505160020b92608435938460020b851415908161017157856124ee91612f90565b92156125d9576101715761251c61251661251161252f94876125349850906113b0565b61303a565b9161303a565b906125283660246111e6565b9184613399565b611306565b5160015f52600760205260405f209080519082549165ffffff000000602083015160181b91600160301b600160b01b03604085015160301b1693606060ff60b01b91015160b01b169462ffffff60ff60b01b1992169060018060b01b0319161716911617171790555f5b601554600181018091116109cd578110156125d257806125bf60019261126d565b5f5260076020525f60408120550161259e565b505f61140e565b5061251c61251661251161252f946115766125349861139d565b602090604051612602816110bb565b5f81525f838201525f60408201525f606082015282828801015201612473565b60801d61243b565b8060030190816003116109cd576001915f52600760205261265460405f20611d90611d8a8461126d565b500161240b565b631ed9bcf960e01b5f5260045ffd5b5060ff811615611409565b506315d7892d60e21b915f91508190565b630fc95b4360e01b5f5260045ffd5b636fce6c3960e01b5f5260045ffd5b80516001600160a01b03908116835260208083015182169084015260408083015162ffffff169084015260608083015160020b9084015260809182015116910152565b91909160e060606101008301946126ff8482516126a4565b60208101516001600160a01b031660a0850152604081015160020b60c085015201511515910152565b602081830312610171578051906001600160401b038211610171570181601f82011215610171578051906001600160401b0382116110d65760405192612778601f8401601f19166020018561113c565b8284526020838301011161017157815f9260208093018386015e8301015290565b600f0b60016001607f1b031981146109cd575f0390565b604051906127bd82611106565b6009546001600160a01b039081168352600a54808216602085015260a081901c62ffffff16604085015260b81c60020b6060840152600b54166080830152565b9190826040910312610171576020825192015190565b81156102fc570490565b60105480421061284b5761283461283d9142611260565b60135490612813565b600181018091116109cd5790565b50600190565b90816020910312610171575190565b9190602090604051828101918252600660408201526040815261288460608261113c565b519020604051631e2eaeaf60e01b8152600481019190915292839060249082906001600160a01b03165afa918215610575575f926128e5575b506001600160a01b0382169160a081901c60020b9162ffffff60b883901c81169260d01c1690565b9091506020813d602011612911575b816129016020938361113c565b810103126101715751905f6128bd565b3d91506128f4565b906101609261292a836060936126a4565b805160020b60a0840152602081015160020b60c0840152604081015160e084015201516101008201526101406101208201525f6101408201520190565b5f9291835b8251811015612b1b576001600160801b0360406129898386611337565b5101511661299a575b60010161296c565b612a4c604060ff60145460181c16805f14612b03576129b98487611337565b515160020b905b15612aef5760206129d18588611337565b51015160020b5b6129fa6001600160801b03846129ee888b611337565b51015116600f0b612799565b60ff6060612a08888b611337565b5101511691845193612a19856110bb565b60020b845260020b6020840152600f0b838301526060820152815180938192632d35e7ed60e11b83528760048401612919565b03815f7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03165af1958615610575575f915f97612aaf575b50612a9c60019392612aa5926146b7565b966006546146b7565b6006559050612992565b612aa59197506001939250612add612a9c9160403d8111612ae8575b612ad5818361113c565b8101906127fd565b989250929350612a8b565b503d612acb565b612af98487611337565b515160020b6129d8565b6020612b0f8588611337565b51015160020b906129c0565b505050565b60405190612b2d82611121565b5f6040838281528260208201520152565b600291820b910b0390627fffff198212627fffff8313176109cd57565b909291612b66612b20565b9360ff60145460181c169181835f14612f4557612b8b91612b8691614400565b614b91565b620100006001600160a01b039182166001600160881b03811160071b81811c6001600160481b031060061b1781811c64ffffffffff1060051b1781811c62ffffff1060041b1781811c9290920160b5600193841c1b0260121c80820401821c80820401821c80820401821c80820401821c80820401821c80820401821c8082040190911c9081900481119003603081901b8216939173fffd8963efd1fc6a506488495d951d51639616826401000276a219860190911611612f325760501b600160201b600160c01b031692838015610171576060612ecd92693627a301d71055774c8587612e9b9460ff612ee59a60018060801b031060071b83811c60018060401b031060061b1783811c63ffffffff1060051b1783811c61ffff1060041b1783811c821060031b177b01c1818141808140018080c0814100004181408140c0c100414140c160221b6f8421084210842108cc6318c6db6d54be85831c1c601f161a17169160808310155f14612f265750607e1982011c5b800280607f1c8160ff1c1c800280607f1c8160ff1c1c800280607f1c8160ff1c1c800280607f1c8160ff1c1c800280607f1c8160ff1c1c800280607f1c8160ff1c1c80029081607f1c8260ff1c1c80029283607f1c8460ff1c1c80029485607f1c8660ff1c1c80029687607f1c8860ff1c1c80029889607f1c8a60ff1c1c80029a8b607f1c8c60ff1c1c80029c8d80607f1c9060ff1c1c600160321b90800260cd1c169d600160331b9060cc1c169c600160341b9060cb1c169b600160351b9060ca1c169a600160361b9060c91c1699600160371b9060c81c1698600160381b9060c71c1697600160391b9060c61c16966001603a1b9060c51c16956001603b1b9060c41c16946001603c1b9060c31c16936001603d1b9060c21c16926001603e1b9060c11c16916001603f1b9060c01c1690607f190160401b1717171717171717171717171717026fdb2df09e81959a81455e260799a0632f6f028f6481ab7f045a5af012a19d003aa919820160801d60020b910160801d60020b918282145f14612f0057509050965b0195865160020b90612f90565b60020b6020880181815295908315612eed5750612ec290865160020b905160020b90612b3e565b60020b80885261303a565b93516001600160801b039490611cf09060020b61303a565b166040830152565b612efb915160020b906113b0565b612ec2565b6001600160a01b03612f118461303a565b1611612f1f57505b96612e8e565b9050612f19565b905081607f031b612d03565b836318521d4960e21b5f5260045260245ffd5b612b8690612f5292614400565b612b8b565b60020b9060020b9081156102fc57627fffff1981145f198314166109cd570590565b9060020b9060020b02908160020b9182036109cd57565b60145460181c60ff1615612ff0575f8160020b125f14612fe257612fb682600192612b3e565b60020b0190627fffff8213627fffff198312176109cd57612fda81612fdf93612f57565b612f79565b90565b90612fda81612fdf93612f57565b5f8160020b125f1461300a5790612fda81612fdf93612f57565b81613014916113b0565b60020b5f190190627fffff198212627fffff8313176109cd57612fda81612fdf93612f57565b60020b908160ff1d82810118620d89e881116133545763ffffffff9192600182167001fffcb933bd6fad37aa2d162d1a59400102600160801b189160028116613338575b6004811661331c575b60088116613300575b601081166132e4575b602081166132c8575b604081166132ac575b60808116613290575b6101008116613274575b6102008116613258575b610400811661323c575b6108008116613220575b6110008116613204575b61200081166131e8575b61400081166131cc575b61800081166131b0575b620100008116613194575b620200008116613179575b62040000811661315e575b6208000016613145575b5f1261313d575b0160201c90565b5f1904613136565b6b048a170391f7dc42444e8fa290910260801c9061312f565b6d2216e584f5fa1ea926041bedfe9890920260801c91613125565b916e5d6af8dedb81196699c329225ee6040260801c9161311a565b916f09aa508b5b7a84e1c677de54f3e99bc90260801c9161310f565b916f31be135f97d08fd981231505542fcfa60260801c91613104565b916f70d869a156d2a1b890bb3df62baf32f70260801c916130fa565b916fa9f746462d870fdf8a65dc1f90e061e50260801c916130f0565b916fd097f3bdfd2022b8845ad8f792aa58250260801c916130e6565b916fe7159475a2c29b7443b29c7fa6e889d90260801c916130dc565b916ff3392b0822b70005940c7a398e4b70f30260801c916130d2565b916ff987a7253ac413176f2b074cf7815e540260801c916130c8565b916ffcbe86c7900a88aedcffc83b479aa3a40260801c916130be565b916ffe5dee046a99a2a811c461f1969c30530260801c916130b4565b916fff2ea16466c96a3843ec78b326b528610260801c916130ab565b916fff973b41fa98c081472e6896dfb254c00260801c916130a2565b916fffcb9843d60f6159c9db58835c9266440260801c91613099565b916fffe5caca7e10e4e61c3624eaa0941cd00260801c91613090565b916ffff2e50f5f656932ef12357cf3c7fdcc0260801c91613087565b916ffff97272373d413259a46990580e213a0260801c9161307e565b826345c3193d60e11b5f5260045260245ffd5b6001600160a01b03918216815291166020820152604081019190915260600190565b600160ff1b81146109cd575f0390565b929392916001600160a01b039182169116818103613823575b50505f915f5b825181101561353b576001600160801b0360406133d58386611337565b510151166133e6575b6001016133b8565b60145460181c60ff16908115613523576134008185611337565b515160020b915b1561350e5760206134188286611337565b51015160020b915b6001600160801b0360406134348488611337565b51015116906001607f1b8210156135015761349e9360409260ff606061345a878b611337565b510151169184519361346b856110bb565b60020b845260020b6020840152600f0b838301526060820152815180948192632d35e7ed60e11b83528a60048401612919565b03815f7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03165af1918215610575576001926134e4575b5090506133de565b6134fb9060403d8111612ae857612ad5818361113c565b506134dc565b6335278d125f526004601cfd5b6135188185611337565b515160020b91613420565b602061352f8286611337565b51015160020b91613407565b508351909291507f000000000000000000000000000000000000000000000000000000000000000090613578906001600160a01b0316308361471f565b60208501805190959190613596906001600160a01b0316308561471f565b915f82136137bc575b848313613747575b8482126136be575b5050828112613627575b50604051630476982d60e21b81529293506020908390600490829085906001600160a01b03165af190811561361b57506135f05750565b6136119060203d602011613614575b613609818361113c565b810190612851565b50565b503d6135ff565b604051903d90823e3d90fd5b84516001600160a01b039081169590831690813b15611eb65760405196632961046560e21b88526004880152848760248183865af19687156136b357859697613694575b50516020939261368b926001600160a01b0390921691906104cc90613389565b908493506135b9565b856136a49196929394959661113c565b611eb65790849392915f61366b565b6040513d87823e3d90fd5b80516001600160a01b03858116929116823b15611e8c5760405190632961046560e21b82526004820152868160248183875af1801561373c57908791613723575b50505161371c926001600160a01b0390911691906104cc90613389565b5f806135af565b8161372d9161113c565b61373857855f6136ff565b8580fd5b6040513d89823e3d90fd5b86516001600160a01b038581169116813b15611e8c578461378392889283604051809681958294630b0d9c0960e01b8452309060048501613367565b03925af180156137b15790869161379c575b50506135a7565b816137a69161113c565b611eb657845f613795565b6040513d88823e3d90fd5b80516001600160a01b03908116908516803b1561017157835f916137f99383604051809681958294630b0d9c0960e01b8452309060048501613367565b03925af180156105755761380e575b5061359f565b61381b9195505f9061113c565b5f935f613808565b6040519161383083611121565b81108252600160208301908152604080840192835251633cf3645360e21b81529261385e60048501886126a4565b51151560a48401525160c4830152516001600160a01b0390811660e48301526101206101048301525f61012483018190526020918391610144918391907f0000000000000000000000000000000000000000000000000000000000000000165af18015610575576138d0575b806133b2565b602090813d83116138f4575b6138e6818361113c565b81010312610171575f6138ca565b503d6138dc565b905f1982019182136001166109cd57565b81810392915f1380158285131691841216176109cd57565b90670de0b6b3a7640000820291808305670de0b6b3a764000014901517156109cd57565b81810292915f8212600160ff1b8214166109cd5781840514901517156109cd57565b9060018201915f6001841291129080158216911516176109cd57565b9190915f83820193841291129080158216911516176109cd57565b919082015f606061010085840312610171576139c9604051936139c3856110bb565b866111e6565b948584526139d960a08201610f01565b80602086015260e06139ed60c0840161102c565b928360408801520135801515958682036101715784015260018060a01b03169060020b93613edd575050600164ffffffffff19815416176001556060840192613a40845160020b6115bb6115b085614820565b6014549060ff8260181c165f14613eca57613a5e9160020b906113b0565b945b613a698461303a565b613a728561303a565b9560405195613a8087611121565b80875260208701818152613b81604089019a888c52613b79600d5495613aa4612b20565b95613ac38c6117d86115126114f36114ea6114e16117d36117ce61281d565b8c929083811315613ebb57613b1a9293508981115f14613eb65750885b928d60185460020b835160020b8082135f14613eae5750905b50818a5260145460181c60ff1615613ea5576118339150895160020b6113b0565b60020b60208701525b855160020b966020870197885160020b14155f14613e9a5760ff60145460181c16613b6e83613b558a5160020b61303a565b8b516001600160801b039491906118939060020b61303a565b166040880152611260565b908488614860565b99613b8f6116708c5161126d565b985160020b915160020b9060018060801b039051169060405192613bb2846110bb565b83526020830152604082015260016060820152613bce88611306565b52613bd887611306565b50805160020b915160020b90604060018060801b03910151169060405192613bff846110bb565b83526020830152604082015260026060820152613c1b86611327565b52613c2585611327565b50835b8751811015613cd857613c3b8189611337565b515160020b6020613c4c838b611337565b51015160020b6001600160801b036040613c66858d611337565b51015116836003019182600311613cc457613cbd92600195949260ff9260405194613c90866110bb565b855260208501526040840152166060820152613cab8361126d565b90613cb6828b611337565b5288611337565b5001613c28565b634e487b7160e01b89526011600452602489fd5b50613ce69293969585613399565b613cef82611306565b516001855260076020908152604080872083518154938501519285015160609095015160189390931b65ffffff000000166001600160b81b031990941662ffffff909116179290921760309390931b600160301b600160b01b03169290921760b09290921b60ff60b01b16919091179055613d6982611327565b516002855260076020908152604080872083518154938501519285015160609095015160189390931b65ffffff000000166001600160b81b031990941662ffffff909116179290921760309390931b600160301b600160b01b03169290921760b09290921b60ff60b01b16919091179055835b8351811015613e7a57613df7613df18261126d565b84611337565b5181600301806003116120f757865260076020908152604080882083518154938501519285015160609095015160189390931b65ffffff000000166001600160b81b031990941662ffffff909116179290921760309390931b600160301b600160b01b03169290921760b09290921b60ff60b01b16919091179055600101613ddc565b509291505060405190613e8e60208361113c565b81525f36602083013790565b8b6040880152611260565b611c8791612b3e565b905090613af9565b613ae0565b50508087526020870152613b23565b613ed79160020b90612b3e565b94613a60565b939250935f925f9260015b601554600301806003116109cd5781101561405357805f526007602052613f1160405f2061134b565b60408101516001600160801b031680613f2f575b5050600101613ee8565b613fb29160409160ff60149a95999a5460181c1691825f1461404557805160020b925b156140345760ff8d613f6f602084015160020b945b600f0b612799565b9201511691845193613f80856110bb565b60020b845260020b6020840152600f0b838301528b820152815180938192632d35e7ed60e11b83528960048401612919565b03815f7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03165af191821561057557600192614009925f905f92614011575b5061400391926146b7565b976146b7565b94905f613f25565b614003925061402e915060403d8111612ae857612ad5818361113c565b91613ff8565b60ff8d613f6f835160020b94613f67565b602081015160020b92613f52565b5093949184919693927f00000000000000000000000000000000000000000000000000000000000000009161409260018060a01b03825116308561471f565b9160208201916140ac60018060a01b03845116308761471f565b935f81136141bd575b5050848313614142575b5050604051630476982d60e21b81529560209287925060049183916001600160a01b03165af190811561361b575061410f575b612fdf92506040519360208501526040840152604083528261113c565b6020833d60201161413a575b816141286020938361113c565b8101031261017157612fdf92506140f2565b3d915061411b565b905192935090916001600160a01b03808516929116823b156141b95791614184939188809460405196879586948593630b0d9c0960e01b855260048501613367565b03925af180156136b3579085916141a0575b80809392936140bf565b816141aa9161113c565b6141b557835f614196565b8380fd5b8780fd5b90519495509293919290916001600160a01b0380871692911690823b156101715761420392845f809460405196879586948593630b0d9c0960e01b855260048501613367565b03925af180156105755761421e575b908188959493926140b5565b61422e9194939297505f9061113c565b5f959091925f614212565b808202905f1983820990828083109203918083039283620f424011156101715714614299577fde8f6cefed634549b62c77574f722e1ac57e23f24d8fd5cb790fb65668c2613993620f4240910990828211900360fa1b910360061c170290565b5050620f424091500490565b90670de0b6b3a76400008202905f19670de0b6b3a7640000840992828085109403938085039485841115610171571461433557670de0b6b3a764000082910981805f03168092046002816003021880820260020302808202600203028082026002030280820260020302808202600203028091026002030293600183805f03040190848311900302920304170290565b5091500490565b808202905f1983820990828083109203918083039283670de0b6b3a7640000111561017157146143a6577faccb18165bd6fe31ae1cf318dc5b51eee0e1ba569b88cd74c1773b91fac1066993670de0b6b3a7640000910990828211900360ee1b910360121c170290565b5050670de0b6b3a764000091500490565b81810291905f1982820991838084109303928084039384600160601b111561017157146143f757600160601b910990828211900360a01b910360601c1790565b50505060601c90565b90606082901b905f19600160601b8409928280851094039380850394858411156101715714614335578190600160601b900981805f03168092046002816003021880820260020302808202600203028082026002030280820260020302808202600203028091026002030293600183805f03040190848311900302920304170290565b91818302915f198185099383808610950394808603958685111561017157146144fb579082910981805f03168092046002816003021880820260020302808202600203028082026002030280820260020302808202600203028091026002030293600183805f03040190848311900302920304170290565b505091500490565b6001600160a01b03168061451657504790565b6020602491604051928380926370a0823160e01b82523060048301525afa908115610575575f91614545575090565b90506020813d60201161456c575b816145606020938361113c565b81010312610171575190565b3d9150614553565b9091906001600160a01b03811690816146025750505f80808093855af1156145995750565b6040516390bfb86560e01b81526001600160a01b0390911660048201525f602482018190526080604483015260a03d601f01601f191690810160648401523d6084840152903d9060a484013e808201600460a482015260c4633d2cec6f60e21b91015260e40190fd5b60205f604481949682604095865198899363a9059cbb60e01b855260018060a01b0316600485015260248401525af13d15601f3d116001855114161716928281528260208201520152156146535750565b6040516390bfb86560e01b8152600481019190915263a9059cbb60e01b602482015260806044820152601f3d01601f191660a0810160648301523d60848301523d5f60a484013e808201600460a482015260c4633c9fd93960e21b91015260e40190fd5b6146da906146cc8360801d8260801d01614b74565b92600f0b90600f0b01614b74565b60018060801b03169060801b1790565b90929091908015614719575f1981019081116109cd57915b1561471057612fdf92614c05565b612fdf92614bc2565b91614702565b6001600160a01b039182165f9081529282166020908152604093849020935163789add5560e11b815260048101949094529183916024918391165afa908115610575575f91614545575090565b6115126114f36114ea6114e16117d3612fdf9561478761281d565b613986565b6147d461202161479f60a06114806127b0565b5050905060ff60145460181c165f146148085760125460020b808260020b135f1461480157505b60125460181c60020b612b3e565b6147e661283460115460105490611260565b9081156102fc57600160ff1b81145f198314166109cd570590565b90506147c6565b60125460020b808260020b125f1461480157506147c6565b80628000000160181c1561483b576335278d125f526004601cfd5b60020b90565b80156109cd575f190190565b818102929181159184041417156109cd57565b9291909161486c61281d565b614879601354809261484d565b90614887601054809361127b565b9060115492838311614b6c575b61489c61281d565b600181018091116109cd576148b9926148b49161484d565b61127b565b91808311614b64575b50808214614b2757808214614b1e576148fc6148eb6149029361150c6115036010548093611260565b9161150c6115036010548093611260565b90611260565b935b6015549384805b614add575b506149276020614931920194855160020b90612b3e565b8560020b90612f57565b918461496860ff60145460181c1694855f14614aa357606085015160020b90818160020b125f14614a9c57505b97600d549061433c565b9180614974838561484d565b11614a8c575050925b5160020b9461498b85611288565b95614999604051978861113c565b858752601f196149a887611288565b015f5b818110614a755750505f905b8682106149c8575050505050505090565b6149d28289611337565b519060020b90526001614a046149f6846149ec858c611337565b515160020b6113b0565b606086015160020b90612f90565b916020614a11828b611337565b51018360020b9052614a56878a614a4f6020614a4486614a3e614a348287611337565b515160020b61303a565b94611337565b51015160020b61303a565b90896146ea565b6040614a62838c611337565b510190838060801b0316905201906149b7565b602090614a80612b20565b82828c010152016149ab565b614a969250612813565b9261497d565b905061495e565b60608501614ab4815160020b61139d565b60020b8260020b125f14614aca57505b97611512565b614ad891505160020b61139d565b614ac4565b945f1986018681116109cd57614af290614c59565b614afb87614c59565b03614b1857614b0c614b1291614841565b95614841565b8061490b565b94614910565b50505f93614904565b505050505050604051614b3b60208261113c565b5f81525f805b818110614b4d57505090565b602090614b58612b20565b82828601015201614b41565b91505f6148c2565b839250614894565b9081600f0b918203614b8257565b6393dafdf160e01b5f5260045ffd5b600160a01b811015613501576001600160a01b031690565b6001600160a01b0391821690821603919082116109cd57565b612fdf92614bfa9290916001600160a01b0380831690821611614bff575b6001600160a01b0391614bf39190614ba9565b1690614400565b614c90565b90614be0565b612fdf92614bfa929091906001600160a01b0380821690831611614c53575b614c4c614c3d6001600160a01b038381169085166143b7565b926001600160a01b0392614ba9565b1691614483565b90614c24565b614c74614c6b614c7d926148b461281d565b6013549061484d565b6010549061127b565b601154808211614c8b575090565b905090565b6001600160801b03811691908203614ca457565b60405162461bcd60e51b81526020600482015260126024820152716c6971756964697479206f766572666c6f7760701b6044820152606490fdfe27db09392d7d230eb65a11bd84925fb8da90df8a067ca8a4fc2933b4f637262bb7c774451310d1be4108bc180d1b52823cb0ee0274a6c0081bcaf94f115fb96da164736f6c634300081a000a";
var DERC20Bytecode = "0x6101e0604052346100b95761002461001561024c565b97969096959195949294610453565b60405161224e90816111b68239608051816115eb015260a051816116a8015260c051816115b5015260e0518161163a0152610100518161166001526101205181610b0001526101405181610b290152610160518181816107ec01526108b1015261018051818181610413015261084901526101a0518181816105eb015261066101526101c05181818161048f01526106830152f35b5f80fd5b634e487b7160e01b5f52604160045260245ffd5b601f909101601f19168101906001600160401b038211908210176100f457604052565b6100bd565b604051906101086040836100d1565b565b81601f820112156100b9578051906001600160401b0382116100f4576040519261013e601f8401601f1916602001856100d1565b828452602083830101116100b957815f9260208093018386015e8301015290565b51906001600160a01b03821682036100b957565b6001600160401b0381116100f45760051b60200190565b9080601f830112156100b95781516101a181610173565b926101af60405194856100d1565b81845260208085019260051b8201019283116100b957602001905b8282106101d75750505090565b602080916101e48461015f565b8152019101906101ca565b9080601f830112156100b957815161020681610173565b9261021460405194856100d1565b81845260208085019260051b8201019283116100b957602001905b82821061023c5750505090565b815181526020918201910161022f565b613444803803806040519261026182856100d1565b83398101610120828203126100b95781516001600160401b0381116100b9578161028c91840161010a565b60208301516001600160401b0381116100b957826102ab91850161010a565b936040840151936102be6060820161015f565b936102cb6080830161015f565b9360a08301519360c08401519360e081015160018060401b0381116100b957846102f691830161018a565b6101008201519094906001600160401b0381116100b95761031792016101ef565b91989796959493929190565b634e487b7160e01b5f52601160045260245ffd5b906301e13380820180921161034857565b610323565b9190820180921161034857565b1561036157565b631dc0052360e11b5f5260045ffd5b90662386f26fc10000820291808304662386f26fc10000149015171561034857565b9067016345785d8a000082029180830467016345785d8a0000149015171561034857565b634e487b7160e01b5f52603260045260245ffd5b80518210156103de5760209160051b010190565b6103b6565b6001600160a01b03165f90815260096020526040902090565b15610405575050565b630443fb3960e11b5f5260045260245260445ffd5b15610423575050565b6323f3f88b60e01b5f5260045260245260445ffd5b5f1981019190821161034857565b9190820391821161034857565b8061046393979599969499610593565b61046c42610337565b6101605261018052426101a0526101c052825161048b8251821461035a565b5f936104a761049985610370565b670de0b6b3a7640000900490565b5f935b8385106104f75750505050506101089291816104d86104ce6104996104e295610392565b838181111561041a565b816104e857610446565b906108ba565b6104f282306108ba565b610446565b909192939561058884600192610583868b61057c61054a61053d8461057261054a61053d878f81610527916103ca565b519c8d61056b61056361054a61053d86866103ca565b516001600160a01b031690565b6001600160a01b03165f908152600f6020526040902090565b91825461034d565b90556103ca565b541115938d6103ca565b54906103fc565b61034d565b9601939291906104aa565b9290604051916105a46040846100d1565b60018352603160f81b60208401908152845190946001600160401b0382116100f4576105da826105d5600354610705565b61073d565b602090601f831160011461067e5791806106019261060995945f92610673575b50506107dc565b6003556107ee565b610612816109f0565b6101205261061f82610ad8565b610140526020815191012060e052519020610100524660a052610640610bbd565b6080523060c0526001600160a01b0381161561065f57610108906109a8565b631e4fbdf760e01b5f90815260045260245ffd5b015190505f806105fa565b60035f52601f19831691907fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b925f5b8181106106ed5750916001939185610609979694106106d5575b505050811b016003556107ee565b01515f1960f88460031b161c191690555f80806106c7565b929360206001819287860151815501950193016106ad565b90600182811c92168015610733575b602083101461071f57565b634e487b7160e01b5f52602260045260245ffd5b91607f1691610714565b601f8111610749575050565b60035f5260205f20906020601f840160051c83019310610783575b601f0160051c01905b818110610778575050565b5f815560010161076d565b9091508190610764565b601f821161079a57505050565b5f5260205f20906020601f840160051c830193106107d2575b601f0160051c01905b8181106107c7575050565b5f81556001016107bc565b90915081906107b3565b8160011b915f199060031b1c19161790565b80519091906001600160401b0381116100f45761081781610810600454610705565b600461078d565b602092601f821160011461083e57610839929382915f926106735750506107dc565b600455565b60045f52601f198216937f8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd19b915f5b8681106108a2575083600195961061088a575b505050811b01600455565b01515f1960f88460031b161c191690555f808061087f565b9192602060018192868501518155019401920161086c565b91906001600160a01b038316801561099557600c546001600160a01b03811682149081610986575b50610977576108fb6108f68360025461034d565b600255565b6001600160a01b0384165f90815260208181526040808320805486019055518481527fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9190a3600254926001600160d01b038085116109605750610108929350610c86565b630e58ae9360e11b5f52600485905260245260445ffd5b632e13674560e01b5f5260045ffd5b60ff915060a01c16155f6108e2565b63ec442f0560e01b5f525f60045260245ffd5b600b80546001600160a01b039283166001600160a01b0319821681179092559091167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e05f80a3565b908151602081105f14610a0b575090610a0890610c1b565b90565b6001600160401b0381116100f457610a2f81610a28600554610705565b600561078d565b602092601f8211600114610a5957610a51929382915f926106735750506107dc565b60055560ff90565b60055f52601f198216937f036b6384b5eca791c62761152d0c79bb0604c104a5fb6f4eb0703f3154bb3db0915f5b868110610ac05750836001959610610aa8575b505050811b0160055560ff90565b01515f1960f88460031b161c191690555f8080610a9a565b91926020600181928685015181550194019201610a87565b908151602081105f14610af0575090610a0890610c1b565b6001600160401b0381116100f457610b1481610b0d600654610705565b600661078d565b602092601f8211600114610b3e57610b36929382915f926106735750506107dc565b60065560ff90565b60065f52601f198216937ff652222313e28459528d920b65115c16c04f3efc82aaedc97be59f3f377c0d3f915f5b868110610ba55750836001959610610b8d575b505050811b0160065560ff90565b01515f1960f88460031b161c191690555f8080610b7f565b91926020600181928685015181550194019201610b6c565b60e051610100516040519060208201927f8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f8452604083015260608201524660808201523060a082015260a08152610c1560c0826100d1565b51902090565b601f815111610c46576020815191015160208210610c37571790565b5f198260200360031b1b161790565b604460209160405192839163305a27a960e01b83528160048401528051918291826024860152018484015e5f828201840152601f01601f19168101030190fd5b90610c9081610d85565b9165ffffffffffff4311610d6d57600a5480610d375750610cca610cba610108945f5b6001611159565b65ffffffffffff4316600a61103a565b50506001600160a01b03168015610d1f575b60086020527f5eff886ea0ce6ca488a3d6e336d6c0f75f46d19b42c06ce5ee98e42c96d256c7545f9182526040909120546001600160a01b039081169116610eb4565b610d30610d2b83610d85565b610db6565b5050610cdc565b92835f1981011161034857600a5f525f805160206134048339815191529093015461010893610cca91610cba919060301c610cb3565b6306dfcc6560e41b5f5260306004524360245260445ffd5b6001600160d01b038111610d9f576001600160d01b031690565b6306dfcc6560e41b5f5260d060045260245260445ffd5b65ffffffffffff4311610d6d57600a5480610de05750610cba610ddc915f5b6002611159565b9091565b805f1981011161034857600a5f525f805160206134048339815191520154610ddc91610cba9160301c610dd5565b65ffffffffffff4311610d6d57805480610e425750610e32610ddc925f6002611159565b9065ffffffffffff43169061103a565b805f19810111610348575f82815260209020015f190154610ddc92610e329160301c610dd5565b65ffffffffffff4311610d6d57805480610e8d5750610e32610ddc925f6001611159565b805f19810111610348575f82815260209020015f190154610ddc92610e329160301c610cb3565b6001600160a01b03808316939291908116908185141580610f89575b610edc575b5050505050565b81610f3e575b505082610ef1575b8080610ed5565b5f8051602061342483398151915291610f15610f0f610f1b936103e3565b91610d85565b90610e69565b604080516001600160d01b039384168152919092166020820152a25f8080610eea565b610f67610f585f80516020613424833981519152926103e3565b610f6186610d85565b90610e0e565b604080516001600160d01b039384168152919092166020820152a25f80610ee2565b50831515610ed0565b9065ffffffffffff82549181199060301b169116179055565b908154680100000000000000008110156100f457600181018084558110156103de57610108925f5260205f20019065ffffffffffff81511665ffffffffffff19835416178255602060018060d01b039101511690610f92565b604080519192919081016001600160401b038111828210176100f457604052915465ffffffffffff8116835260301c6020830152565b8054929392919082156111305761106661106161105685610438565b835f5260205f200190565b611004565b9065ffffffffffff61107e835165ffffffffffff1690565b8185169182911611611121576110e59460209488926110b16110a6875165ffffffffffff1690565b65ffffffffffff1690565b036110e957506110d7926110c76110d292610438565b905f5260205f200190565b610f92565b01516001600160d01b031690565b9190565b91505061111c916111096110fb6100f9565b65ffffffffffff9093168352565b6001600160d01b03881682860152610fab565b6110d7565b632520601d60e01b5f5260045ffd5b61115492506111406110fb6100f9565b6001600160d01b0385166020830152610fab565b5f9190565b9190918060011461119b5760021461117f57634e487b7160e01b5f52605160045260245ffd5b6001600160d01b03908116918116919091039081116103485790565b506001600160d01b0391821690821601908111610348579056fe60806040526004361015610011575f80fd5b5f3560e01c806306fdde0314610284578063095ea7b31461027f5780630a24c5bb1461027a57806310aa0ebb1461027557806313cff13d146102705780631514617e1461026b57806316f0115b1461026657806318160ddd14610261578063207d06361461025c57806323b872dd14610257578063254800d414610252578063313ce5671461024d5780633644e5151461024857806337bdc99b146102435780633a46b1a81461023e57806340c10f191461023957806349b5fe1f146102345780634bf5d7e91461022f578063587cde1e1461022a5780635c19a95c146102255780635e64e1d2146102205780636fcfff451461021b57806370a0823114610216578063715018a6146102115780637ecebe001461020c57806384b0196e1461020757806389026538146102025780638da5cb5b146101fd5780638e539e8c146101f857806391ddadf4146101f357806395d89b41146101ee5780639ab24eb0146101e9578063a9059cbb146101e4578063c3cda520146101df578063d505accf146101da578063dd62ed3e146101d5578063f1127ed8146101d0578063f2fde38b146101cb5763f6939d34146101c6575f80fd5b611254565b611170565b6110d9565b61108e565b610f83565b610e8b565b610e45565b610dfe565b610d59565b610d2e565b610c3a565b610c12565b610be5565b610ae8565b610ab0565b610a68565b610a45565b6109e3565b6109c6565b6109a4565b610964565b6108d4565b61089a565b6107c6565b610731565b61064b565b610629565b61060e565b6105d4565b61053a565b6104f7565b6104da565b6104b2565b610478565b61045b565b610436565b6103fc565b6103cb565b6102c1565b805180835260209291819084018484015e5f828201840152601f01601f1916010190565b9060206102be928181520190610289565b90565b3461039b575f36600319011261039b576040515f6003546102e1816112ac565b80845290600181169081156103775750600114610319575b6103158361030981850382611399565b604051918291826102ad565b0390f35b60035f9081527fc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b939250905b80821061035d575090915081016020016103096102f9565b919260018160209254838588010152019101909291610345565b60ff191660208086019190915291151560051b8401909101915061030990506102f9565b5f80fd5b600435906001600160a01b038216820361039b57565b602435906001600160a01b038216820361039b57565b3461039b57604036600319011261039b576103f16103e761039f565b602435903361192c565b602060405160018152f35b3461039b575f36600319011261039b5760206040517f00000000000000000000000000000000000000000000000000000000000000008152f35b3461039b575f36600319011261039b57602060ff600c5460a01c166040519015158152f35b3461039b575f36600319011261039b576020600d54604051908152f35b3461039b575f36600319011261039b5760206040517f00000000000000000000000000000000000000000000000000000000000000008152f35b3461039b575f36600319011261039b57600c546040516001600160a01b039091168152602090f35b3461039b575f36600319011261039b576020600254604051908152f35b3461039b57602036600319011261039b5761051061039f565b610518611492565b600c80546001600160a81b0319166001600160a01b0392909216919091179055005b3461039b57606036600319011261039b5761055361039f565b61055b6103b5565b6044359060018060a01b0383165f52600160205261057c3360405f2061122e565b54926001840161059d575b61059193506114b9565b60405160018152602090f35b8284106105b9576105b483610591950333836119b7565b610587565b8284637dc7a0d960e11b5f523360045260245260445260645ffd5b3461039b575f36600319011261039b5760206040517f00000000000000000000000000000000000000000000000000000000000000008152f35b3461039b575f36600319011261039b57602060405160128152f35b3461039b575f36600319011261039b5760206106436115b2565b604051908152f35b3461039b57602036600319011261039b576004357f0000000000000000000000000000000000000000000000000000000000000000907f00000000000000000000000000000000000000000000000000000000000000008083019283811161072c57610716934210156107185761070f916106dd6106e2926106d76106cf336111e3565b5491426113e5565b906113f2565b611405565b60016106ed336111e3565b016106f98482546113ca565b90556001610706336111e3565b01541115611423565b33306114b9565b005b505061070f610726336111e3565b546106e2565b611298565b3461039b57604036600319011261039b5761074a61039f565b60243565ffffffffffff61075d436116ce565b1691828210156107b0576001600160a01b03165f90815260096020526040902061031592506001600160d01b039161079f9190610799906116ce565b906116fd565b604051911681529081906020820190565b50637669fc0f60e11b5f5260045260245260445ffd5b3461039b57604036600319011261039b576107df61039f565b6024356107ea611492565b7f0000000000000000000000000000000000000000000000000000000000000000421061088b57600d546301e13380810180911161072c5742101561087e575b600e549181830180841161072c57610874836107169561086f610879947f00000000000000000000000000000000000000000000000000000000000000001015611439565b6113ca565b600e55565b61178e565b42600d555f600e5561082a565b633601f27d60e11b5f5260045ffd5b3461039b575f36600319011261039b5760206040517f00000000000000000000000000000000000000000000000000000000000000008152f35b3461039b575f36600319011261039b576108ed436116ce565b65ffffffffffff806108fe436116ce565b1691160361095557610315604051610917604082611399565b601d81527f6d6f64653d626c6f636b6e756d6265722666726f6d3d64656661756c740000006020820152604051918291602083526020830190610289565b6301bfc1c560e61b5f5260045ffd5b3461039b57602036600319011261039b576001600160a01b0361098561039f565b165f526008602052602060018060a01b0360405f205416604051908152f35b3461039b57602036600319011261039b576107166109c061039f565b3361183f565b3461039b575f36600319011261039b576020600e54604051908152f35b3461039b57602036600319011261039b576001600160a01b03610a0461039f565b165f52600960205260405f205463ffffffff8111610a2e5760405163ffffffff9091168152602090f35b6306dfcc6560e41b5f52602060045260245260445ffd5b3461039b57602036600319011261039b576020610643610a6361039f565b611460565b3461039b575f36600319011261039b57610a80611492565b600b80546001600160a01b031981169091555f906001600160a01b03165f805160206121e28339815191528280a3005b3461039b57602036600319011261039b576001600160a01b03610ad161039f565b165f526007602052602060405f2054604051908152f35b3461039b575f36600319011261039b57610b8c610b247f0000000000000000000000000000000000000000000000000000000000000000611cac565b610b4d7f0000000000000000000000000000000000000000000000000000000000000000611d0c565b6020604051610b5c8282611399565b5f815281610b9a81830194601f198301368737604051978897600f60f81b895260e0858a015260e0890190610289565b908782036040890152610289565b914660608701523060808701525f60a087015285830360c087015251918281520192915f5b828110610bce57505050500390f35b835185528695509381019392810192600101610bbf565b3461039b575f36600319011261039b57610bfd611492565b600c805460ff60a01b1916600160a01b179055005b3461039b575f36600319011261039b57600b546040516001600160a01b039091168152602090f35b3461039b57602036600319011261039b5760043565ffffffffffff610c5e436116ce565b169081811015610d1957610c71906116ce565b600a54905f829160058411610cc5575b610c8d9350600a611b60565b80610ca9575060205f5b6040516001600160d01b039091168152f35b610cb46020916113d7565b600a5f52815f20015460301c610c97565b9192610cd0816119ed565b810390811161072c57610c8d93600a5f5265ffffffffffff8260205f2001541665ffffffffffff8516105f14610d07575091610c81565b929150610d13906113bc565b90610c81565b637669fc0f60e11b5f5260045260245260445ffd5b3461039b575f36600319011261039b576020610d49436116ce565b65ffffffffffff60405191168152f35b3461039b575f36600319011261039b576040515f600454610d79816112ac565b80845290600181169081156103775750600114610da0576103158361030981850382611399565b60045f9081527f8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd19b939250905b808210610de4575090915081016020016103096102f9565b919260018160209254838588010152019101909291610dcc565b3461039b57602036600319011261039b576001600160a01b03610e1f61039f565b165f526009602052602060018060d01b03610e3c60405f206118ab565b16604051908152f35b3461039b57604036600319011261039b576103f1610e6161039f565b60243590336114b9565b6064359060ff8216820361039b57565b6084359060ff8216820361039b57565b3461039b5760c036600319011261039b57610ea461039f565b60243590604435610eb3610e6b565b6084359060a43592804211610f715791610f389391610f2a610f2f9460405160208101917fe48329057bfd03d55e49b547132e39cffd9c1820ad7b9d4c5307691425d15adf835260018060a01b038a1660408301528a6060830152608082015260808152610f2260a082611399565b5190206118d5565b611d43565b90929192611de4565b610f418161190a565b809303610f5257610716925061183f565b90506301d4b62360e61b5f5260018060a01b031660045260245260445ffd5b632341d78760e11b5f5260045260245ffd5b3461039b5760e036600319011261039b57610f9c61039f565b610fa46103b5565b6044359060643592610fb4610e7b565b60a43560c4359086421161107b576110409261103b610fd28661190a565b9860405160208101917f6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9835260018060a01b0389169b8c604084015260018060a01b038b1660608401528b608084015260a083015260c082015260c08152610f2260e082611399565b6118fb565b936001600160a01b0385160361105a57610716935061192c565b6325c0072360e11b5f526001600160a01b038085166004521660245260445ffd5b8663313c898160e11b5f5260045260245ffd5b3461039b57604036600319011261039b5760206110d06110ac61039f565b6110b46103b5565b6001600160a01b039091165f908152600184526040902061122e565b54604051908152f35b3461039b57604036600319011261039b576110f261039f565b6024359063ffffffff8216820361039b57611147916111419161111361147a565b5061111c61147a565b506001600160a01b03165f90815260096020526040902061113b61147a565b50611e60565b50611e89565b60408051825165ffffffffffff1681526020928301516001600160d01b03169281019290925290f35b3461039b57602036600319011261039b5761118961039f565b611191611492565b6001600160a01b031680156111d057600b80546001600160a01b0319811683179091556001600160a01b03165f805160206121e28339815191525f80a3005b631e4fbdf760e01b5f525f60045260245ffd5b6001600160a01b03165f908152600f6020526040902090565b6001600160a01b03165f90815260208190526040902090565b6001600160a01b03165f90815260096020526040902090565b9060018060a01b03165f5260205260405f2090565b908152602081019190915260400190565b3461039b57602036600319011261039b576001600160a01b0361127561039f565b165f52600f60205260405f20600181549101549061031560405192839283611243565b634e487b7160e01b5f52601160045260245ffd5b90600182811c921680156112da575b60208310146112c657565b634e487b7160e01b5f52602260045260245ffd5b91607f16916112bb565b5f92918154916112f3836112ac565b8083529260018116908115611348575060011461130f57505050565b5f9081526020812093945091925b83831061132e575060209250010190565b60018160209294939454838587010152019101919061131d565b915050602093945060ff929192191683830152151560051b010190565b634e487b7160e01b5f52604160045260245ffd5b604081019081106001600160401b0382111761139457604052565b611365565b601f909101601f19168101906001600160401b0382119082101761139457604052565b906001820180921161072c57565b9190820180921161072c57565b5f1981019190821161072c57565b9190820391821161072c57565b8181029291811591840414171561072c57565b811561140f570490565b634e487b7160e01b5f52601260045260245ffd5b1561142a57565b637d2fec4b60e11b5f5260045ffd5b1561144057565b6367dbf5a960e01b5f5260045ffd5b6040519061145e604083611399565b565b6001600160a01b03165f9081526020819052604090205490565b6040519061148782611379565b5f6020838281520152565b600b546001600160a01b031633036114a657565b63118cdaa760e01b5f523360045260245ffd5b6001600160a01b03811693929190841561159f576001600160a01b038216801561158c57600c546001600160a01b0381168214908161157d575b5061156e57611501826111fc565b5495848710611548578461145e96970361151a846111fc565b55611524846111fc565b8054860190556040518581525f8051602061220283398151915290602090a3611f91565b63391434e360e21b5f526001600160a01b0383166004526024879052604485905260645ffd5b632e13674560e01b5f5260045ffd5b60ff915060a01c16155f6114f3565b63ec442f0560e01b5f525f60045260245ffd5b634b637e8f60e11b5f525f60045260245ffd5b307f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031614806116a5575b1561160d577f000000000000000000000000000000000000000000000000000000000000000090565b60405160208101907f8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f82527f000000000000000000000000000000000000000000000000000000000000000060408201527f000000000000000000000000000000000000000000000000000000000000000060608201524660808201523060a082015260a0815261169f60c082611399565b51902090565b507f000000000000000000000000000000000000000000000000000000000000000046146115e4565b65ffffffffffff81116116e65765ffffffffffff1690565b6306dfcc6560e41b5f52603060045260245260445ffd5b908154905f82916005841161173b575b611718935084611b60565b806117235750505f90565b61172c906113d7565b905f5260205f20015460301c90565b9192611746816119ed565b810390811161072c5761171893855f5265ffffffffffff8260205f2001541665ffffffffffff8516105f1461177c57509161170d565b929150611788906113bc565b9061170d565b91906001600160a01b038316801561158c57600c546001600160a01b03811682149081611830575b5061156e576117cf6117ca836002546113ca565b600255565b6117d8846111fc565b8054830190556040518281525f905f8051602061220283398151915290602090a3600254926001600160d01b03808511611819575061145e9293505f611f91565b630e58ae9360e11b5f52600485905260245260445ffd5b60ff915060a01c16155f6117b6565b6001600160a01b038181165f81815260086020526040812080548685166001600160a01b03198216811790925561145e969416946118a59390928691907f3134e8a2e6d97e929a7e54011ea5485d7d196dd5f0ba4d4ef95803e8e3fc257f9080a4611460565b91611bc4565b805490816118b95750505f90565b815f1981011161072c575f525f199060205f2001015460301c90565b6042906118e06115b2565b906040519161190160f01b8352600283015260228201522090565b916102be9391610f2f93611d43565b6001600160a01b03165f90815260076020526040902080546001810190915590565b6001600160a01b03169081156119a4576001600160a01b03811692831561199157806119847f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92593855f52600160205260405f2061122e565b55604051908152602090a3565b634a1406b160e11b5f525f60045260245ffd5b63e602df0560e01b5f525f60045260245ffd5b6001600160a01b03169081156119a4576001600160a01b03811615611991576119ea915f52600160205260405f2061122e565b55565b8015611b5b576102be90611af1611aea611ae0611ad6611acc611ac2611ab8611aae6001611a9c5f8b608081901c80611b4d575b5080611a30611a929260401c90565b80611b40575b50611a418160201c90565b80611b33575b50611a528160101c90565b80611b26575b50611a638160081c90565b80611b19575b50611a748160041c90565b80611b0c575b50611a858160021c90565b80611aff575b5060011c90565b611af75760011c90565b1b611aa7818b611405565b0160011c90565b611aa7818a611405565b611aa78189611405565b611aa78188611405565b611aa78187611405565b611aa78186611405565b611aa78185611405565b8092611405565b90611ead565b820160011c90565b600291509201915f611a8b565b600491509201915f611a7a565b600891509201915f611a69565b601091509201915f611a58565b602091509201915f611a47565b604091509201915f611a36565b608092509050611a92611a21565b505f90565b91905b838210611b705750505090565b9091928083169080841860011c820180921161072c57845f5265ffffffffffff8260205f2001541665ffffffffffff8416105f14611bb25750925b9190611b63565b939250611bbe906113bc565b91611bab565b6001600160a01b03808316939291908116908185141580611ca3575b611bec575b5050505050565b81611c53575b505082611c01575b8080611be5565b5f8051602061222283398151915291611c25611c1f611c2b93611215565b91611ebf565b90611f28565b604051918291611c48916001600160d01b03918216911683611243565b0390a25f8080611bfa565b611c7c611c6d5f8051602061222283398151915292611215565b611c7686611ebf565b90611ef0565b604051918291611c99916001600160d01b03918216911683611243565b0390a25f80611bf2565b50831515611be0565b60ff8114611cf25760ff811690601f8211611ce35760405191611cd0604084611399565b6020808452838101919036833783525290565b632cd44ac360e21b5f5260045ffd5b506040516102be81611d058160056112e4565b0382611399565b60ff8114611d305760ff811690601f8211611ce35760405191611cd0604084611399565b506040516102be81611d058160066112e4565b91906fa2a8918ca85bafe22016d0b997e4df60600160ff1b038411611dbb579160209360809260ff5f9560405194855216868401526040830152606082015282805260015afa15611db0575f516001600160a01b03811615611da657905f905f90565b505f906001905f90565b6040513d5f823e3d90fd5b5050505f9160039190565b60041115611dd057565b634e487b7160e01b5f52602160045260245ffd5b611ded81611dc6565b80611df6575050565b611dff81611dc6565b60018103611e165763f645eedf60e01b5f5260045ffd5b611e1f81611dc6565b60028103611e3a575063fce698f760e01b5f5260045260245ffd5b80611e46600392611dc6565b14611e4e5750565b6335e2f38360e21b5f5260045260245ffd5b8054821015611e75575f5260205f2001905f90565b634e487b7160e01b5f52603260045260245ffd5b90604051611e9681611379565b915465ffffffffffff8116835260301c6020830152565b9080821015611eba575090565b905090565b6001600160d01b038111611ed9576001600160d01b031690565b6306dfcc6560e41b5f5260d060045260245260445ffd5b90611efa436116ce565b90611f04836118ab565b6001600160d01b03918216908216039190821161072c57611f24926120c2565b9091565b90611f32436116ce565b90611f3c836118ab565b6001600160d01b03918216908216019190821161072c57611f24926120c2565b611f65436116ce565b90611f70600a6118ab565b6001600160d01b039182169082160390811161072c57611f2491600a6120c2565b9091906001600160a01b03168015611ff8575b61145e926001600160a01b0316908115611fe0575b5f90815260086020526040808220549282529020546001600160a01b039081169116611bc4565b611ff1611fec84611ebf565b611f5c565b5050611fb9565b61200182611ebf565b9261200b436116ce565b93612016600a6118ab565b6001600160d01b03918216908216019490851161072c5761145e9461203c91600a6120c2565b9050509250611fa4565b9065ffffffffffff82549181199060301b169116179055565b8054600160401b8110156113945761207c91600182018155611e60565b6120af578165ffffffffffff61145e93511665ffffffffffff19835416178255602060018060d01b039101511690612046565b634e487b7160e01b5f525f60045260245ffd5b8054929392919082156121b8576120ee6120e96120de856113d7565b835f5260205f200190565b611e89565b9065ffffffffffff612106835165ffffffffffff1690565b81851691829116116121a95761216d94602094889261213961212e875165ffffffffffff1690565b65ffffffffffff1690565b03612171575061215f9261214f61215a926113d7565b905f5260205f200190565b612046565b01516001600160d01b031690565b9190565b9150506121a49161219161218361144f565b65ffffffffffff9093168352565b6001600160d01b0388168286015261205f565b61215f565b632520601d60e01b5f5260045ffd5b6121dc92506121c861218361144f565b6001600160d01b038516602083015261205f565b5f919056fe8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efdec2bacdd2f05b59de34da9b523dff8be42e5e38e818c82fdb0bae774387a724a164736f6c634300081a000ac65a7bb8d6351c1cf70c95a316cc6a92839c986682d98bc35f958f4883f9d2a7dec2bacdd2f05b59de34da9b523dff8be42e5e38e818c82fdb0bae774387a724";

// ../../node_modules/viem/_esm/utils/abi/encodePacked.js
function encodePacked(types, values) {
  if (types.length !== values.length)
    throw new AbiEncodingLengthMismatchError({
      expectedLength: types.length,
      givenLength: values.length
    });
  const data = [];
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const value = values[i];
    data.push(encode(type, value));
  }
  return concatHex(data);
}
function encode(type, value, isArray = false) {
  if (type === "address") {
    const address = value;
    if (!isAddress(address))
      throw new InvalidAddressError({ address });
    return pad(address.toLowerCase(), {
      size: isArray ? 32 : null
    });
  }
  if (type === "string")
    return stringToHex(value);
  if (type === "bytes")
    return value;
  if (type === "bool")
    return pad(boolToHex(value), { size: isArray ? 32 : 1 });
  const intMatch = type.match(integerRegex);
  if (intMatch) {
    const [_type, baseType, bits = "256"] = intMatch;
    const size = Number.parseInt(bits) / 8;
    return numberToHex(value, {
      size: isArray ? 32 : size,
      signed: baseType === "int"
    });
  }
  const bytesMatch = type.match(bytesRegex);
  if (bytesMatch) {
    const [_type, size] = bytesMatch;
    if (Number.parseInt(size) !== (value.length - 2) / 2)
      throw new BytesSizeMismatchError({
        expectedSize: Number.parseInt(size),
        givenSize: (value.length - 2) / 2
      });
    return pad(value, { dir: "right", size: isArray ? 32 : null });
  }
  const arrayMatch = type.match(arrayRegex);
  if (arrayMatch && Array.isArray(value)) {
    const [_type, childType] = arrayMatch;
    const data = [];
    for (let i = 0; i < value.length; i++) {
      data.push(encode(childType, value[i], true));
    }
    if (data.length === 0)
      return "0x";
    return concatHex(data);
  }
  throw new UnsupportedPackedAbiType(type);
}

// ../../node_modules/viem/_esm/errors/unit.js
var InvalidDecimalNumberError = class extends BaseError {
  constructor({ value }) {
    super(`Number \`${value}\` is not a valid decimal number.`, {
      name: "InvalidDecimalNumberError"
    });
  }
};

// ../../node_modules/viem/_esm/utils/unit/parseUnits.js
function parseUnits(value, decimals) {
  if (!/^(-?)([0-9]*)\.?([0-9]*)$/.test(value))
    throw new InvalidDecimalNumberError({ value });
  let [integer, fraction = "0"] = value.split(".");
  const negative = integer.startsWith("-");
  if (negative)
    integer = integer.slice(1);
  fraction = fraction.replace(/(0+)$/, "");
  if (decimals === 0) {
    if (Math.round(Number(`.${fraction}`)) === 1)
      integer = `${BigInt(integer) + 1n}`;
    fraction = "";
  } else if (fraction.length > decimals) {
    const [left, unit, right] = [
      fraction.slice(0, decimals - 1),
      fraction.slice(decimals - 1, decimals),
      fraction.slice(decimals)
    ];
    const rounded = Math.round(Number(`${unit}.${right}`));
    if (rounded > 9)
      fraction = `${BigInt(left) + BigInt(1)}0`.padStart(left.length + 1, "0");
    else
      fraction = `${left}${rounded}`;
    if (fraction.length > decimals) {
      fraction = fraction.slice(1);
      integer = `${BigInt(integer) + 1n}`;
    }
    fraction = fraction.slice(0, decimals);
  } else {
    fraction = fraction.padEnd(decimals, "0");
  }
  return BigInt(`${negative ? "-" : ""}${integer}${fraction}`);
}

// ../../node_modules/viem/_esm/utils/unit/parseEther.js
function parseEther(ether, unit = "wei") {
  return parseUnits(ether, etherUnits[unit]);
}

// src/entities/token/derc20/ReadDerc20.ts
import { Drift } from "@delvtech/drift";
var ReadDerc20 = class {
  constructor(address, drift = new Drift()) {
    this.contract = drift.contract({ abi: derc20Abi, address });
  }
  async getName() {
    return this.contract.read("name");
  }
  async getSymbol() {
    return this.contract.read("symbol");
  }
  async getDecimals() {
    return this.contract.read("decimals");
  }
  async getAllowance(owner, spender) {
    return this.contract.read("allowance", { owner, spender });
  }
  async getBalanceOf(account) {
    return this.contract.read("balanceOf", { account });
  }
};

// src/entities/token/eth/ReadEth.ts
import { Drift as Drift2 } from "@delvtech/drift";

// src/constants.ts
var MAX_TICK_SPACING = 30;
var DEFAULT_PD_SLUGS = 5;
var DAY_SECONDS = 24 * 60 * 60;
var ETH_ADDRESS = "0x0000000000000000000000000000000000000000";

// src/entities/token/eth/ReadEth.ts
var ReadEth = class {
  constructor(drift = new Drift2()) {
    this.drift = drift;
  }
  async getName() {
    return "Ether";
  }
  async getSymbol() {
    return "ETH";
  }
  async getDecimals() {
    return 18;
  }
  async getAllowance() {
    return 2n ** 256n - 1n;
  }
  async getBalanceOf(account) {
    return this.drift.getBalance({ address: account });
  }
};
ReadEth.address = ETH_ADDRESS;

// src/entities/doppler/ReadDoppler.ts
var ReadDoppler = class {
  constructor(dopplerAddress, stateViewAddress, drift = new Drift3()) {
    this.address = dopplerAddress;
    this.doppler = drift.contract({
      abi: dopplerAbi,
      address: dopplerAddress
    });
    this.stateView = drift.contract({
      abi: stateViewAbi,
      address: stateViewAddress
    });
  }
  async getState() {
    return this.doppler.read("state");
  }
  async getPosition(salt) {
    return this.doppler.read("positions", { salt });
  }
  async getSlot0(id2) {
    return this.stateView.read("getSlot0", { poolId: id2 });
  }
  async getCurrentPrice() {
    const { sqrtPriceX96 } = await this.getSlot0(this.poolId);
    return sqrtPriceX96 * sqrtPriceX96 / BigInt(2 ** 192);
  }
  async getPoolKey() {
    return this.doppler.read("poolKey");
  }
  async getPoolId() {
    const poolKey = await this.getPoolKey();
    const tokenA = poolKey.currency0.toLowerCase() > poolKey.currency1.toLowerCase() ? poolKey.currency1 : poolKey.currency0;
    const tokenB = poolKey.currency0.toLowerCase() > poolKey.currency1.toLowerCase() ? poolKey.currency0 : poolKey.currency1;
    const poolId = keccak256(
      encodePacked(
        ["address", "address", "uint24", "uint24", "address"],
        [tokenA, tokenB, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
      )
    );
    return poolId;
  }
  async getAssetToken() {
    const poolKey = await this.getPoolKey();
    return new ReadDerc20(poolKey.currency1, this.drift);
  }
  async getQuoteToken() {
    const poolKey = await this.getPoolKey();
    return poolKey.currency0.toLowerCase() === ETH_ADDRESS.toLowerCase() ? new ReadEth(this.drift) : new ReadDerc20(poolKey.currency0, this.drift);
  }
  async getInsufficientProceeds() {
    return this.doppler.read("insufficientProceeds");
  }
  async getEarlyExit() {
    return this.doppler.read("earlyExit");
  }
  // async getSwapEvents(): Promise<EventFilter<DopplerABI, 'DopplerSwap'>> {
  //   return this.doppler.getEvents('DopplerSwap');
  // }
};

// src/entities/factory/ReadFactory.ts
import { Drift as Drift4 } from "@delvtech/drift";
var ModuleState = /* @__PURE__ */ ((ModuleState2) => {
  ModuleState2[ModuleState2["NotWhitelisted"] = 0] = "NotWhitelisted";
  ModuleState2[ModuleState2["TokenFactory"] = 1] = "TokenFactory";
  ModuleState2[ModuleState2["GovernanceFactory"] = 2] = "GovernanceFactory";
  ModuleState2[ModuleState2["HookFactory"] = 3] = "HookFactory";
  ModuleState2[ModuleState2["Migrator"] = 4] = "Migrator";
  return ModuleState2;
})(ModuleState || {});
var ReadFactory = class {
  constructor(address, drift = new Drift4()) {
    this.airlock = drift.contract({
      abi: airlockAbi,
      address
    });
  }
  async getModuleState(module) {
    return this.airlock.read("getModuleState", {
      module
    });
  }
  async getAssetData(asset) {
    return this.airlock.read("getAssetData", {
      asset
    });
  }
  // async getCreateEvents(): Promise<EventFilter<AirlockABI, 'Create'>> {
  //   return this.airlock.getEvents('Create');
  // }
  // async getMigrateEvents(): Promise<EventFilter<AirlockABI, 'Migrate'>> {
  //   return this.airlock.getEvents('Migrate');
  // }
  // async getSetModuleStateEvents(): Promise<
  //   EventFilter<AirlockABI, 'SetModuleState'>
  // > {
  //   return this.airlock.getEvents('SetModuleState');
  // }
};

// src/entities/factory/ReadWriteFactory.ts
var ReadWriteFactory = class extends ReadFactory {
  constructor(address, drift) {
    super(address, drift);
  }
  async create(params, options) {
    return this.airlock.write("create", { createData: params }, options);
  }
};

// src/entities/factory/utils/configBuilder.ts
import { Price as Price2, Token } from "@uniswap/sdk-core";

// ../../node_modules/@uniswap/v3-sdk/dist/v3-sdk.esm.js
import { ChainId, computeZksyncCreate2Address, MaxUint256 as MaxUint2562, sqrt, Price, CurrencyAmount, Percent, TradeType, Fraction, sortedInsert, validateAndParseAddress } from "@uniswap/sdk-core";

// ../../node_modules/jsbi/dist/jsbi.mjs
var JSBI = class _JSBI extends Array {
  constructor(i, _) {
    if (super(i), this.sign = _, i > _JSBI.__kMaxLength) throw new RangeError("Maximum BigInt size exceeded");
  }
  static BigInt(i) {
    var _ = Math.floor, t = Number.isFinite;
    if ("number" == typeof i) {
      if (0 === i) return _JSBI.__zero();
      if (_JSBI.__isOneDigitInt(i)) return 0 > i ? _JSBI.__oneDigit(-i, true) : _JSBI.__oneDigit(i, false);
      if (!t(i) || _(i) !== i) throw new RangeError("The number " + i + " cannot be converted to BigInt because it is not an integer");
      return _JSBI.__fromDouble(i);
    }
    if ("string" == typeof i) {
      const _2 = _JSBI.__fromString(i);
      if (null === _2) throw new SyntaxError("Cannot convert " + i + " to a BigInt");
      return _2;
    }
    if ("boolean" == typeof i) return true === i ? _JSBI.__oneDigit(1, false) : _JSBI.__zero();
    if ("object" == typeof i) {
      if (i.constructor === _JSBI) return i;
      const _2 = _JSBI.__toPrimitive(i);
      return _JSBI.BigInt(_2);
    }
    throw new TypeError("Cannot convert " + i + " to a BigInt");
  }
  toDebugString() {
    const i = ["BigInt["];
    for (const _ of this) i.push((_ ? (_ >>> 0).toString(16) : _) + ", ");
    return i.push("]"), i.join("");
  }
  toString(i = 10) {
    if (2 > i || 36 < i) throw new RangeError("toString() radix argument must be between 2 and 36");
    return 0 === this.length ? "0" : 0 == (i & i - 1) ? _JSBI.__toStringBasePowerOfTwo(this, i) : _JSBI.__toStringGeneric(this, i, false);
  }
  static toNumber(i) {
    const _ = i.length;
    if (0 === _) return 0;
    if (1 === _) {
      const _2 = i.__unsignedDigit(0);
      return i.sign ? -_2 : _2;
    }
    const t = i.__digit(_ - 1), e = _JSBI.__clz30(t), n = 30 * _ - e;
    if (1024 < n) return i.sign ? -Infinity : 1 / 0;
    let g = n - 1, o = t, s = _ - 1;
    const l = e + 3;
    let r = 32 === l ? 0 : o << l;
    r >>>= 12;
    const a = l - 12;
    let u = 12 <= l ? 0 : o << 20 + l, d = 20 + l;
    for (0 < a && 0 < s && (s--, o = i.__digit(s), r |= o >>> 30 - a, u = o << a + 2, d = a + 2); 0 < d && 0 < s; ) s--, o = i.__digit(s), u |= 30 <= d ? o << d - 30 : o >>> 30 - d, d -= 30;
    const h = _JSBI.__decideRounding(i, d, s, o);
    if ((1 === h || 0 === h && 1 == (1 & u)) && (u = u + 1 >>> 0, 0 === u && (r++, 0 != r >>> 20 && (r = 0, g++, 1023 < g)))) return i.sign ? -Infinity : 1 / 0;
    const m = i.sign ? -2147483648 : 0;
    return g = g + 1023 << 20, _JSBI.__kBitConversionInts[1] = m | g | r, _JSBI.__kBitConversionInts[0] = u, _JSBI.__kBitConversionDouble[0];
  }
  static unaryMinus(i) {
    if (0 === i.length) return i;
    const _ = i.__copy();
    return _.sign = !i.sign, _;
  }
  static bitwiseNot(i) {
    return i.sign ? _JSBI.__absoluteSubOne(i).__trim() : _JSBI.__absoluteAddOne(i, true);
  }
  static exponentiate(i, _) {
    if (_.sign) throw new RangeError("Exponent must be positive");
    if (0 === _.length) return _JSBI.__oneDigit(1, false);
    if (0 === i.length) return i;
    if (1 === i.length && 1 === i.__digit(0)) return i.sign && 0 == (1 & _.__digit(0)) ? _JSBI.unaryMinus(i) : i;
    if (1 < _.length) throw new RangeError("BigInt too big");
    let t = _.__unsignedDigit(0);
    if (1 === t) return i;
    if (t >= _JSBI.__kMaxLengthBits) throw new RangeError("BigInt too big");
    if (1 === i.length && 2 === i.__digit(0)) {
      const _2 = 1 + (0 | t / 30), e2 = i.sign && 0 != (1 & t), n2 = new _JSBI(_2, e2);
      n2.__initializeDigits();
      const g = 1 << t % 30;
      return n2.__setDigit(_2 - 1, g), n2;
    }
    let e = null, n = i;
    for (0 != (1 & t) && (e = i), t >>= 1; 0 !== t; t >>= 1) n = _JSBI.multiply(n, n), 0 != (1 & t) && (null === e ? e = n : e = _JSBI.multiply(e, n));
    return e;
  }
  static multiply(_, t) {
    if (0 === _.length) return _;
    if (0 === t.length) return t;
    let i = _.length + t.length;
    30 <= _.__clzmsd() + t.__clzmsd() && i--;
    const e = new _JSBI(i, _.sign !== t.sign);
    e.__initializeDigits();
    for (let n = 0; n < _.length; n++) _JSBI.__multiplyAccumulate(t, _.__digit(n), e, n);
    return e.__trim();
  }
  static divide(i, _) {
    if (0 === _.length) throw new RangeError("Division by zero");
    if (0 > _JSBI.__absoluteCompare(i, _)) return _JSBI.__zero();
    const t = i.sign !== _.sign, e = _.__unsignedDigit(0);
    let n;
    if (1 === _.length && 32767 >= e) {
      if (1 === e) return t === i.sign ? i : _JSBI.unaryMinus(i);
      n = _JSBI.__absoluteDivSmall(i, e, null);
    } else n = _JSBI.__absoluteDivLarge(i, _, true, false);
    return n.sign = t, n.__trim();
  }
  static remainder(i, _) {
    if (0 === _.length) throw new RangeError("Division by zero");
    if (0 > _JSBI.__absoluteCompare(i, _)) return i;
    const t = _.__unsignedDigit(0);
    if (1 === _.length && 32767 >= t) {
      if (1 === t) return _JSBI.__zero();
      const _2 = _JSBI.__absoluteModSmall(i, t);
      return 0 === _2 ? _JSBI.__zero() : _JSBI.__oneDigit(_2, i.sign);
    }
    const e = _JSBI.__absoluteDivLarge(i, _, false, true);
    return e.sign = i.sign, e.__trim();
  }
  static add(i, _) {
    const t = i.sign;
    return t === _.sign ? _JSBI.__absoluteAdd(i, _, t) : 0 <= _JSBI.__absoluteCompare(i, _) ? _JSBI.__absoluteSub(i, _, t) : _JSBI.__absoluteSub(_, i, !t);
  }
  static subtract(i, _) {
    const t = i.sign;
    return t === _.sign ? 0 <= _JSBI.__absoluteCompare(i, _) ? _JSBI.__absoluteSub(i, _, t) : _JSBI.__absoluteSub(_, i, !t) : _JSBI.__absoluteAdd(i, _, t);
  }
  static leftShift(i, _) {
    return 0 === _.length || 0 === i.length ? i : _.sign ? _JSBI.__rightShiftByAbsolute(i, _) : _JSBI.__leftShiftByAbsolute(i, _);
  }
  static signedRightShift(i, _) {
    return 0 === _.length || 0 === i.length ? i : _.sign ? _JSBI.__leftShiftByAbsolute(i, _) : _JSBI.__rightShiftByAbsolute(i, _);
  }
  static unsignedRightShift() {
    throw new TypeError("BigInts have no unsigned right shift; use >> instead");
  }
  static lessThan(i, _) {
    return 0 > _JSBI.__compareToBigInt(i, _);
  }
  static lessThanOrEqual(i, _) {
    return 0 >= _JSBI.__compareToBigInt(i, _);
  }
  static greaterThan(i, _) {
    return 0 < _JSBI.__compareToBigInt(i, _);
  }
  static greaterThanOrEqual(i, _) {
    return 0 <= _JSBI.__compareToBigInt(i, _);
  }
  static equal(_, t) {
    if (_.sign !== t.sign) return false;
    if (_.length !== t.length) return false;
    for (let e = 0; e < _.length; e++) if (_.__digit(e) !== t.__digit(e)) return false;
    return true;
  }
  static notEqual(i, _) {
    return !_JSBI.equal(i, _);
  }
  static bitwiseAnd(i, _) {
    var t = Math.max;
    if (!i.sign && !_.sign) return _JSBI.__absoluteAnd(i, _).__trim();
    if (i.sign && _.sign) {
      const e = t(i.length, _.length) + 1;
      let n = _JSBI.__absoluteSubOne(i, e);
      const g = _JSBI.__absoluteSubOne(_);
      return n = _JSBI.__absoluteOr(n, g, n), _JSBI.__absoluteAddOne(n, true, n).__trim();
    }
    return i.sign && ([i, _] = [_, i]), _JSBI.__absoluteAndNot(i, _JSBI.__absoluteSubOne(_)).__trim();
  }
  static bitwiseXor(i, _) {
    var t = Math.max;
    if (!i.sign && !_.sign) return _JSBI.__absoluteXor(i, _).__trim();
    if (i.sign && _.sign) {
      const e2 = t(i.length, _.length), n2 = _JSBI.__absoluteSubOne(i, e2), g = _JSBI.__absoluteSubOne(_);
      return _JSBI.__absoluteXor(n2, g, n2).__trim();
    }
    const e = t(i.length, _.length) + 1;
    i.sign && ([i, _] = [_, i]);
    let n = _JSBI.__absoluteSubOne(_, e);
    return n = _JSBI.__absoluteXor(n, i, n), _JSBI.__absoluteAddOne(n, true, n).__trim();
  }
  static bitwiseOr(i, _) {
    var t = Math.max;
    const e = t(i.length, _.length);
    if (!i.sign && !_.sign) return _JSBI.__absoluteOr(i, _).__trim();
    if (i.sign && _.sign) {
      let t2 = _JSBI.__absoluteSubOne(i, e);
      const n2 = _JSBI.__absoluteSubOne(_);
      return t2 = _JSBI.__absoluteAnd(t2, n2, t2), _JSBI.__absoluteAddOne(t2, true, t2).__trim();
    }
    i.sign && ([i, _] = [_, i]);
    let n = _JSBI.__absoluteSubOne(_, e);
    return n = _JSBI.__absoluteAndNot(n, i, n), _JSBI.__absoluteAddOne(n, true, n).__trim();
  }
  static asIntN(_, t) {
    var i = Math.floor;
    if (0 === t.length) return t;
    if (_ = i(_), 0 > _) throw new RangeError("Invalid value: not (convertible to) a safe integer");
    if (0 === _) return _JSBI.__zero();
    if (_ >= _JSBI.__kMaxLengthBits) return t;
    const e = 0 | (_ + 29) / 30;
    if (t.length < e) return t;
    const g = t.__unsignedDigit(e - 1), o = 1 << (_ - 1) % 30;
    if (t.length === e && g < o) return t;
    if (!((g & o) === o)) return _JSBI.__truncateToNBits(_, t);
    if (!t.sign) return _JSBI.__truncateAndSubFromPowerOfTwo(_, t, true);
    if (0 == (g & o - 1)) {
      for (let n = e - 2; 0 <= n; n--) if (0 !== t.__digit(n)) return _JSBI.__truncateAndSubFromPowerOfTwo(_, t, false);
      return t.length === e && g === o ? t : _JSBI.__truncateToNBits(_, t);
    }
    return _JSBI.__truncateAndSubFromPowerOfTwo(_, t, false);
  }
  static asUintN(i, _) {
    var t = Math.floor;
    if (0 === _.length) return _;
    if (i = t(i), 0 > i) throw new RangeError("Invalid value: not (convertible to) a safe integer");
    if (0 === i) return _JSBI.__zero();
    if (_.sign) {
      if (i > _JSBI.__kMaxLengthBits) throw new RangeError("BigInt too big");
      return _JSBI.__truncateAndSubFromPowerOfTwo(i, _, false);
    }
    if (i >= _JSBI.__kMaxLengthBits) return _;
    const e = 0 | (i + 29) / 30;
    if (_.length < e) return _;
    const g = i % 30;
    if (_.length == e) {
      if (0 === g) return _;
      const i2 = _.__digit(e - 1);
      if (0 == i2 >>> g) return _;
    }
    return _JSBI.__truncateToNBits(i, _);
  }
  static ADD(i, _) {
    if (i = _JSBI.__toPrimitive(i), _ = _JSBI.__toPrimitive(_), "string" == typeof i) return "string" != typeof _ && (_ = _.toString()), i + _;
    if ("string" == typeof _) return i.toString() + _;
    if (i = _JSBI.__toNumeric(i), _ = _JSBI.__toNumeric(_), _JSBI.__isBigInt(i) && _JSBI.__isBigInt(_)) return _JSBI.add(i, _);
    if ("number" == typeof i && "number" == typeof _) return i + _;
    throw new TypeError("Cannot mix BigInt and other types, use explicit conversions");
  }
  static LT(i, _) {
    return _JSBI.__compare(i, _, 0);
  }
  static LE(i, _) {
    return _JSBI.__compare(i, _, 1);
  }
  static GT(i, _) {
    return _JSBI.__compare(i, _, 2);
  }
  static GE(i, _) {
    return _JSBI.__compare(i, _, 3);
  }
  static EQ(i, _) {
    for (; ; ) {
      if (_JSBI.__isBigInt(i)) return _JSBI.__isBigInt(_) ? _JSBI.equal(i, _) : _JSBI.EQ(_, i);
      if ("number" == typeof i) {
        if (_JSBI.__isBigInt(_)) return _JSBI.__equalToNumber(_, i);
        if ("object" != typeof _) return i == _;
        _ = _JSBI.__toPrimitive(_);
      } else if ("string" == typeof i) {
        if (_JSBI.__isBigInt(_)) return i = _JSBI.__fromString(i), null !== i && _JSBI.equal(i, _);
        if ("object" != typeof _) return i == _;
        _ = _JSBI.__toPrimitive(_);
      } else if ("boolean" == typeof i) {
        if (_JSBI.__isBigInt(_)) return _JSBI.__equalToNumber(_, +i);
        if ("object" != typeof _) return i == _;
        _ = _JSBI.__toPrimitive(_);
      } else if ("symbol" == typeof i) {
        if (_JSBI.__isBigInt(_)) return false;
        if ("object" != typeof _) return i == _;
        _ = _JSBI.__toPrimitive(_);
      } else if ("object" == typeof i) {
        if ("object" == typeof _ && _.constructor !== _JSBI) return i == _;
        i = _JSBI.__toPrimitive(i);
      } else return i == _;
    }
  }
  static NE(i, _) {
    return !_JSBI.EQ(i, _);
  }
  static __zero() {
    return new _JSBI(0, false);
  }
  static __oneDigit(i, _) {
    const t = new _JSBI(1, _);
    return t.__setDigit(0, i), t;
  }
  __copy() {
    const _ = new _JSBI(this.length, this.sign);
    for (let t = 0; t < this.length; t++) _[t] = this[t];
    return _;
  }
  __trim() {
    let i = this.length, _ = this[i - 1];
    for (; 0 === _; ) i--, _ = this[i - 1], this.pop();
    return 0 === i && (this.sign = false), this;
  }
  __initializeDigits() {
    for (let _ = 0; _ < this.length; _++) this[_] = 0;
  }
  static __decideRounding(i, _, t, e) {
    if (0 < _) return -1;
    let n;
    if (0 > _) n = -_ - 1;
    else {
      if (0 === t) return -1;
      t--, e = i.__digit(t), n = 29;
    }
    let g = 1 << n;
    if (0 == (e & g)) return -1;
    if (g -= 1, 0 != (e & g)) return 1;
    for (; 0 < t; ) if (t--, 0 !== i.__digit(t)) return 1;
    return 0;
  }
  static __fromDouble(i) {
    _JSBI.__kBitConversionDouble[0] = i;
    const _ = 2047 & _JSBI.__kBitConversionInts[1] >>> 20, t = _ - 1023, e = (0 | t / 30) + 1, n = new _JSBI(e, 0 > i);
    let g = 1048575 & _JSBI.__kBitConversionInts[1] | 1048576, o = _JSBI.__kBitConversionInts[0];
    const s = 20, l = t % 30;
    let r, a = 0;
    if (l < 20) {
      const i2 = s - l;
      a = i2 + 32, r = g >>> i2, g = g << 32 - i2 | o >>> i2, o <<= 32 - i2;
    } else if (l === 20) a = 32, r = g, g = o, o = 0;
    else {
      const i2 = l - s;
      a = 32 - i2, r = g << i2 | o >>> 32 - i2, g = o << i2, o = 0;
    }
    n.__setDigit(e - 1, r);
    for (let _2 = e - 2; 0 <= _2; _2--) 0 < a ? (a -= 30, r = g >>> 2, g = g << 30 | o >>> 2, o <<= 30) : r = 0, n.__setDigit(_2, r);
    return n.__trim();
  }
  static __isWhitespace(i) {
    return !!(13 >= i && 9 <= i) || (159 >= i ? 32 == i : 131071 >= i ? 160 == i || 5760 == i : 196607 >= i ? (i &= 131071, 10 >= i || 40 == i || 41 == i || 47 == i || 95 == i || 4096 == i) : 65279 == i);
  }
  static __fromString(i, _ = 0) {
    let t = 0;
    const e = i.length;
    let n = 0;
    if (n === e) return _JSBI.__zero();
    let g = i.charCodeAt(n);
    for (; _JSBI.__isWhitespace(g); ) {
      if (++n === e) return _JSBI.__zero();
      g = i.charCodeAt(n);
    }
    if (43 === g) {
      if (++n === e) return null;
      g = i.charCodeAt(n), t = 1;
    } else if (45 === g) {
      if (++n === e) return null;
      g = i.charCodeAt(n), t = -1;
    }
    if (0 === _) {
      if (_ = 10, 48 === g) {
        if (++n === e) return _JSBI.__zero();
        if (g = i.charCodeAt(n), 88 === g || 120 === g) {
          if (_ = 16, ++n === e) return null;
          g = i.charCodeAt(n);
        } else if (79 === g || 111 === g) {
          if (_ = 8, ++n === e) return null;
          g = i.charCodeAt(n);
        } else if (66 === g || 98 === g) {
          if (_ = 2, ++n === e) return null;
          g = i.charCodeAt(n);
        }
      }
    } else if (16 === _ && 48 === g) {
      if (++n === e) return _JSBI.__zero();
      if (g = i.charCodeAt(n), 88 === g || 120 === g) {
        if (++n === e) return null;
        g = i.charCodeAt(n);
      }
    }
    if (0 != t && 10 !== _) return null;
    for (; 48 === g; ) {
      if (++n === e) return _JSBI.__zero();
      g = i.charCodeAt(n);
    }
    const o = e - n;
    let s = _JSBI.__kMaxBitsPerChar[_], l = _JSBI.__kBitsPerCharTableMultiplier - 1;
    if (o > 1073741824 / s) return null;
    const r = s * o + l >>> _JSBI.__kBitsPerCharTableShift, a = new _JSBI(0 | (r + 29) / 30, false), u = 10 > _ ? _ : 10, h = 10 < _ ? _ - 10 : 0;
    if (0 == (_ & _ - 1)) {
      s >>= _JSBI.__kBitsPerCharTableShift;
      const _2 = [], t2 = [];
      let o2 = false;
      do {
        let l2 = 0, r2 = 0;
        for (; ; ) {
          let _3;
          if (g - 48 >>> 0 < u) _3 = g - 48;
          else if ((32 | g) - 97 >>> 0 < h) _3 = (32 | g) - 87;
          else {
            o2 = true;
            break;
          }
          if (r2 += s, l2 = l2 << s | _3, ++n === e) {
            o2 = true;
            break;
          }
          if (g = i.charCodeAt(n), 30 < r2 + s) break;
        }
        _2.push(l2), t2.push(r2);
      } while (!o2);
      _JSBI.__fillFromParts(a, _2, t2);
    } else {
      a.__initializeDigits();
      let t2 = false, o2 = 0;
      do {
        let r2 = 0, b = 1;
        for (; ; ) {
          let s2;
          if (g - 48 >>> 0 < u) s2 = g - 48;
          else if ((32 | g) - 97 >>> 0 < h) s2 = (32 | g) - 87;
          else {
            t2 = true;
            break;
          }
          const l2 = b * _;
          if (1073741823 < l2) break;
          if (b = l2, r2 = r2 * _ + s2, o2++, ++n === e) {
            t2 = true;
            break;
          }
          g = i.charCodeAt(n);
        }
        l = 30 * _JSBI.__kBitsPerCharTableMultiplier - 1;
        const D = 0 | (s * o2 + l >>> _JSBI.__kBitsPerCharTableShift) / 30;
        a.__inplaceMultiplyAdd(b, r2, D);
      } while (!t2);
    }
    if (n !== e) {
      if (!_JSBI.__isWhitespace(g)) return null;
      for (n++; n < e; n++) if (g = i.charCodeAt(n), !_JSBI.__isWhitespace(g)) return null;
    }
    return a.sign = -1 == t, a.__trim();
  }
  static __fillFromParts(_, t, e) {
    let n = 0, g = 0, o = 0;
    for (let s = t.length - 1; 0 <= s; s--) {
      const i = t[s], l = e[s];
      g |= i << o, o += l, 30 === o ? (_.__setDigit(n++, g), o = 0, g = 0) : 30 < o && (_.__setDigit(n++, 1073741823 & g), o -= 30, g = i >>> l - o);
    }
    if (0 !== g) {
      if (n >= _.length) throw new Error("implementation bug");
      _.__setDigit(n++, g);
    }
    for (; n < _.length; n++) _.__setDigit(n, 0);
  }
  static __toStringBasePowerOfTwo(_, i) {
    const t = _.length;
    let e = i - 1;
    e = (85 & e >>> 1) + (85 & e), e = (51 & e >>> 2) + (51 & e), e = (15 & e >>> 4) + (15 & e);
    const n = e, g = i - 1, o = _.__digit(t - 1), s = _JSBI.__clz30(o);
    let l = 0 | (30 * t - s + n - 1) / n;
    if (_.sign && l++, 268435456 < l) throw new Error("string too long");
    const r = Array(l);
    let a = l - 1, u = 0, d = 0;
    for (let e2 = 0; e2 < t - 1; e2++) {
      const i2 = _.__digit(e2), t2 = (u | i2 << d) & g;
      r[a--] = _JSBI.__kConversionChars[t2];
      const o2 = n - d;
      for (u = i2 >>> o2, d = 30 - o2; d >= n; ) r[a--] = _JSBI.__kConversionChars[u & g], u >>>= n, d -= n;
    }
    const h = (u | o << d) & g;
    for (r[a--] = _JSBI.__kConversionChars[h], u = o >>> n - d; 0 !== u; ) r[a--] = _JSBI.__kConversionChars[u & g], u >>>= n;
    if (_.sign && (r[a--] = "-"), -1 != a) throw new Error("implementation bug");
    return r.join("");
  }
  static __toStringGeneric(_, i, t) {
    const e = _.length;
    if (0 === e) return "";
    if (1 === e) {
      let e2 = _.__unsignedDigit(0).toString(i);
      return false === t && _.sign && (e2 = "-" + e2), e2;
    }
    const n = 30 * e - _JSBI.__clz30(_.__digit(e - 1)), g = _JSBI.__kMaxBitsPerChar[i], o = g - 1;
    let s = n * _JSBI.__kBitsPerCharTableMultiplier;
    s += o - 1, s = 0 | s / o;
    const l = s + 1 >> 1, r = _JSBI.exponentiate(_JSBI.__oneDigit(i, false), _JSBI.__oneDigit(l, false));
    let a, u;
    const d = r.__unsignedDigit(0);
    if (1 === r.length && 32767 >= d) {
      a = new _JSBI(_.length, false), a.__initializeDigits();
      let t2 = 0;
      for (let e2 = 2 * _.length - 1; 0 <= e2; e2--) {
        const i2 = t2 << 15 | _.__halfDigit(e2);
        a.__setHalfDigit(e2, 0 | i2 / d), t2 = 0 | i2 % d;
      }
      u = t2.toString(i);
    } else {
      const t2 = _JSBI.__absoluteDivLarge(_, r, true, true);
      a = t2.quotient;
      const e2 = t2.remainder.__trim();
      u = _JSBI.__toStringGeneric(e2, i, true);
    }
    a.__trim();
    let h = _JSBI.__toStringGeneric(a, i, true);
    for (; u.length < l; ) u = "0" + u;
    return false === t && _.sign && (h = "-" + h), h + u;
  }
  static __unequalSign(i) {
    return i ? -1 : 1;
  }
  static __absoluteGreater(i) {
    return i ? -1 : 1;
  }
  static __absoluteLess(i) {
    return i ? 1 : -1;
  }
  static __compareToBigInt(i, _) {
    const t = i.sign;
    if (t !== _.sign) return _JSBI.__unequalSign(t);
    const e = _JSBI.__absoluteCompare(i, _);
    return 0 < e ? _JSBI.__absoluteGreater(t) : 0 > e ? _JSBI.__absoluteLess(t) : 0;
  }
  static __compareToNumber(i, _) {
    if (_JSBI.__isOneDigitInt(_)) {
      const t = i.sign, e = 0 > _;
      if (t !== e) return _JSBI.__unequalSign(t);
      if (0 === i.length) {
        if (e) throw new Error("implementation bug");
        return 0 === _ ? 0 : -1;
      }
      if (1 < i.length) return _JSBI.__absoluteGreater(t);
      const n = Math.abs(_), g = i.__unsignedDigit(0);
      return g > n ? _JSBI.__absoluteGreater(t) : g < n ? _JSBI.__absoluteLess(t) : 0;
    }
    return _JSBI.__compareToDouble(i, _);
  }
  static __compareToDouble(i, _) {
    if (_ !== _) return _;
    if (_ === 1 / 0) return -1;
    if (_ === -Infinity) return 1;
    const t = i.sign;
    if (t !== 0 > _) return _JSBI.__unequalSign(t);
    if (0 === _) throw new Error("implementation bug: should be handled elsewhere");
    if (0 === i.length) return -1;
    _JSBI.__kBitConversionDouble[0] = _;
    const e = 2047 & _JSBI.__kBitConversionInts[1] >>> 20;
    if (2047 == e) throw new Error("implementation bug: handled elsewhere");
    const n = e - 1023;
    if (0 > n) return _JSBI.__absoluteGreater(t);
    const g = i.length;
    let o = i.__digit(g - 1);
    const s = _JSBI.__clz30(o), l = 30 * g - s, r = n + 1;
    if (l < r) return _JSBI.__absoluteLess(t);
    if (l > r) return _JSBI.__absoluteGreater(t);
    let a = 1048576 | 1048575 & _JSBI.__kBitConversionInts[1], u = _JSBI.__kBitConversionInts[0];
    const d = 20, h = 29 - s;
    if (h !== (0 | (l - 1) % 30)) throw new Error("implementation bug");
    let m, b = 0;
    if (20 > h) {
      const i2 = d - h;
      b = i2 + 32, m = a >>> i2, a = a << 32 - i2 | u >>> i2, u <<= 32 - i2;
    } else if (20 === h) b = 32, m = a, a = u, u = 0;
    else {
      const i2 = h - d;
      b = 32 - i2, m = a << i2 | u >>> 32 - i2, a = u << i2, u = 0;
    }
    if (o >>>= 0, m >>>= 0, o > m) return _JSBI.__absoluteGreater(t);
    if (o < m) return _JSBI.__absoluteLess(t);
    for (let e2 = g - 2; 0 <= e2; e2--) {
      0 < b ? (b -= 30, m = a >>> 2, a = a << 30 | u >>> 2, u <<= 30) : m = 0;
      const _2 = i.__unsignedDigit(e2);
      if (_2 > m) return _JSBI.__absoluteGreater(t);
      if (_2 < m) return _JSBI.__absoluteLess(t);
    }
    if (0 !== a || 0 !== u) {
      if (0 === b) throw new Error("implementation bug");
      return _JSBI.__absoluteLess(t);
    }
    return 0;
  }
  static __equalToNumber(i, _) {
    var t = Math.abs;
    return _JSBI.__isOneDigitInt(_) ? 0 === _ ? 0 === i.length : 1 === i.length && i.sign === 0 > _ && i.__unsignedDigit(0) === t(_) : 0 === _JSBI.__compareToDouble(i, _);
  }
  static __comparisonResultToBool(i, _) {
    return 0 === _ ? 0 > i : 1 === _ ? 0 >= i : 2 === _ ? 0 < i : 3 === _ ? 0 <= i : void 0;
  }
  static __compare(i, _, t) {
    if (i = _JSBI.__toPrimitive(i), _ = _JSBI.__toPrimitive(_), "string" == typeof i && "string" == typeof _) switch (t) {
      case 0:
        return i < _;
      case 1:
        return i <= _;
      case 2:
        return i > _;
      case 3:
        return i >= _;
    }
    if (_JSBI.__isBigInt(i) && "string" == typeof _) return _ = _JSBI.__fromString(_), null !== _ && _JSBI.__comparisonResultToBool(_JSBI.__compareToBigInt(i, _), t);
    if ("string" == typeof i && _JSBI.__isBigInt(_)) return i = _JSBI.__fromString(i), null !== i && _JSBI.__comparisonResultToBool(_JSBI.__compareToBigInt(i, _), t);
    if (i = _JSBI.__toNumeric(i), _ = _JSBI.__toNumeric(_), _JSBI.__isBigInt(i)) {
      if (_JSBI.__isBigInt(_)) return _JSBI.__comparisonResultToBool(_JSBI.__compareToBigInt(i, _), t);
      if ("number" != typeof _) throw new Error("implementation bug");
      return _JSBI.__comparisonResultToBool(_JSBI.__compareToNumber(i, _), t);
    }
    if ("number" != typeof i) throw new Error("implementation bug");
    if (_JSBI.__isBigInt(_)) return _JSBI.__comparisonResultToBool(_JSBI.__compareToNumber(_, i), 2 ^ t);
    if ("number" != typeof _) throw new Error("implementation bug");
    return 0 === t ? i < _ : 1 === t ? i <= _ : 2 === t ? i > _ : 3 === t ? i >= _ : void 0;
  }
  __clzmsd() {
    return _JSBI.__clz30(this.__digit(this.length - 1));
  }
  static __absoluteAdd(_, t, e) {
    if (_.length < t.length) return _JSBI.__absoluteAdd(t, _, e);
    if (0 === _.length) return _;
    if (0 === t.length) return _.sign === e ? _ : _JSBI.unaryMinus(_);
    let n = _.length;
    (0 === _.__clzmsd() || t.length === _.length && 0 === t.__clzmsd()) && n++;
    const g = new _JSBI(n, e);
    let o = 0, s = 0;
    for (; s < t.length; s++) {
      const i = _.__digit(s) + t.__digit(s) + o;
      o = i >>> 30, g.__setDigit(s, 1073741823 & i);
    }
    for (; s < _.length; s++) {
      const i = _.__digit(s) + o;
      o = i >>> 30, g.__setDigit(s, 1073741823 & i);
    }
    return s < g.length && g.__setDigit(s, o), g.__trim();
  }
  static __absoluteSub(_, t, e) {
    if (0 === _.length) return _;
    if (0 === t.length) return _.sign === e ? _ : _JSBI.unaryMinus(_);
    const n = new _JSBI(_.length, e);
    let g = 0, o = 0;
    for (; o < t.length; o++) {
      const i = _.__digit(o) - t.__digit(o) - g;
      g = 1 & i >>> 30, n.__setDigit(o, 1073741823 & i);
    }
    for (; o < _.length; o++) {
      const i = _.__digit(o) - g;
      g = 1 & i >>> 30, n.__setDigit(o, 1073741823 & i);
    }
    return n.__trim();
  }
  static __absoluteAddOne(_, i, t = null) {
    const e = _.length;
    null === t ? t = new _JSBI(e, i) : t.sign = i;
    let n = 1;
    for (let g = 0; g < e; g++) {
      const i2 = _.__digit(g) + n;
      n = i2 >>> 30, t.__setDigit(g, 1073741823 & i2);
    }
    return 0 != n && t.__setDigitGrow(e, 1), t;
  }
  static __absoluteSubOne(_, t) {
    const e = _.length;
    t = t || e;
    const n = new _JSBI(t, false);
    let g = 1;
    for (let o = 0; o < e; o++) {
      const i = _.__digit(o) - g;
      g = 1 & i >>> 30, n.__setDigit(o, 1073741823 & i);
    }
    if (0 != g) throw new Error("implementation bug");
    for (let g2 = e; g2 < t; g2++) n.__setDigit(g2, 0);
    return n;
  }
  static __absoluteAnd(_, t, e = null) {
    let n = _.length, g = t.length, o = g;
    if (n < g) {
      o = n;
      const i = _, e2 = n;
      _ = t, n = g, t = i, g = e2;
    }
    let s = o;
    null === e ? e = new _JSBI(s, false) : s = e.length;
    let l = 0;
    for (; l < o; l++) e.__setDigit(l, _.__digit(l) & t.__digit(l));
    for (; l < s; l++) e.__setDigit(l, 0);
    return e;
  }
  static __absoluteAndNot(_, t, e = null) {
    const n = _.length, g = t.length;
    let o = g;
    n < g && (o = n);
    let s = n;
    null === e ? e = new _JSBI(s, false) : s = e.length;
    let l = 0;
    for (; l < o; l++) e.__setDigit(l, _.__digit(l) & ~t.__digit(l));
    for (; l < n; l++) e.__setDigit(l, _.__digit(l));
    for (; l < s; l++) e.__setDigit(l, 0);
    return e;
  }
  static __absoluteOr(_, t, e = null) {
    let n = _.length, g = t.length, o = g;
    if (n < g) {
      o = n;
      const i = _, e2 = n;
      _ = t, n = g, t = i, g = e2;
    }
    let s = n;
    null === e ? e = new _JSBI(s, false) : s = e.length;
    let l = 0;
    for (; l < o; l++) e.__setDigit(l, _.__digit(l) | t.__digit(l));
    for (; l < n; l++) e.__setDigit(l, _.__digit(l));
    for (; l < s; l++) e.__setDigit(l, 0);
    return e;
  }
  static __absoluteXor(_, t, e = null) {
    let n = _.length, g = t.length, o = g;
    if (n < g) {
      o = n;
      const i = _, e2 = n;
      _ = t, n = g, t = i, g = e2;
    }
    let s = n;
    null === e ? e = new _JSBI(s, false) : s = e.length;
    let l = 0;
    for (; l < o; l++) e.__setDigit(l, _.__digit(l) ^ t.__digit(l));
    for (; l < n; l++) e.__setDigit(l, _.__digit(l));
    for (; l < s; l++) e.__setDigit(l, 0);
    return e;
  }
  static __absoluteCompare(_, t) {
    const e = _.length - t.length;
    if (0 != e) return e;
    let n = _.length - 1;
    for (; 0 <= n && _.__digit(n) === t.__digit(n); ) n--;
    return 0 > n ? 0 : _.__unsignedDigit(n) > t.__unsignedDigit(n) ? 1 : -1;
  }
  static __multiplyAccumulate(_, t, e, n) {
    if (0 === t) return;
    const g = 32767 & t, o = t >>> 15;
    let s = 0, l = 0;
    for (let r, a = 0; a < _.length; a++, n++) {
      r = e.__digit(n);
      const i = _.__digit(a), t2 = 32767 & i, u = i >>> 15, d = _JSBI.__imul(t2, g), h = _JSBI.__imul(t2, o), m = _JSBI.__imul(u, g), b = _JSBI.__imul(u, o);
      r += l + d + s, s = r >>> 30, r &= 1073741823, r += ((32767 & h) << 15) + ((32767 & m) << 15), s += r >>> 30, l = b + (h >>> 15) + (m >>> 15), e.__setDigit(n, 1073741823 & r);
    }
    for (; 0 != s || 0 !== l; n++) {
      let i = e.__digit(n);
      i += s + l, l = 0, s = i >>> 30, e.__setDigit(n, 1073741823 & i);
    }
  }
  static __internalMultiplyAdd(_, t, e, g, o) {
    let s = e, l = 0;
    for (let n = 0; n < g; n++) {
      const i = _.__digit(n), e2 = _JSBI.__imul(32767 & i, t), g2 = _JSBI.__imul(i >>> 15, t), a = e2 + ((32767 & g2) << 15) + l + s;
      s = a >>> 30, l = g2 >>> 15, o.__setDigit(n, 1073741823 & a);
    }
    if (o.length > g) for (o.__setDigit(g++, s + l); g < o.length; ) o.__setDigit(g++, 0);
    else if (0 !== s + l) throw new Error("implementation bug");
  }
  __inplaceMultiplyAdd(i, _, t) {
    t > this.length && (t = this.length);
    const e = 32767 & i, n = i >>> 15;
    let g = 0, o = _;
    for (let s = 0; s < t; s++) {
      const i2 = this.__digit(s), _2 = 32767 & i2, t2 = i2 >>> 15, l = _JSBI.__imul(_2, e), r = _JSBI.__imul(_2, n), a = _JSBI.__imul(t2, e), u = _JSBI.__imul(t2, n);
      let d = o + l + g;
      g = d >>> 30, d &= 1073741823, d += ((32767 & r) << 15) + ((32767 & a) << 15), g += d >>> 30, o = u + (r >>> 15) + (a >>> 15), this.__setDigit(s, 1073741823 & d);
    }
    if (0 != g || 0 !== o) throw new Error("implementation bug");
  }
  static __absoluteDivSmall(_, t, e = null) {
    null === e && (e = new _JSBI(_.length, false));
    let n = 0;
    for (let g, o = 2 * _.length - 1; 0 <= o; o -= 2) {
      g = (n << 15 | _.__halfDigit(o)) >>> 0;
      const i = 0 | g / t;
      n = 0 | g % t, g = (n << 15 | _.__halfDigit(o - 1)) >>> 0;
      const s = 0 | g / t;
      n = 0 | g % t, e.__setDigit(o >>> 1, i << 15 | s);
    }
    return e;
  }
  static __absoluteModSmall(_, t) {
    let e = 0;
    for (let n = 2 * _.length - 1; 0 <= n; n--) {
      const i = (e << 15 | _.__halfDigit(n)) >>> 0;
      e = 0 | i % t;
    }
    return e;
  }
  static __absoluteDivLarge(i, _, t, e) {
    const g = _.__halfDigitLength(), n = _.length, o = i.__halfDigitLength() - g;
    let s = null;
    t && (s = new _JSBI(o + 2 >>> 1, false), s.__initializeDigits());
    const l = new _JSBI(g + 2 >>> 1, false);
    l.__initializeDigits();
    const r = _JSBI.__clz15(_.__halfDigit(g - 1));
    0 < r && (_ = _JSBI.__specialLeftShift(_, r, 0));
    const a = _JSBI.__specialLeftShift(i, r, 1), u = _.__halfDigit(g - 1);
    let d = 0;
    for (let r2, h = o; 0 <= h; h--) {
      r2 = 32767;
      const i2 = a.__halfDigit(h + g);
      if (i2 !== u) {
        const t2 = (i2 << 15 | a.__halfDigit(h + g - 1)) >>> 0;
        r2 = 0 | t2 / u;
        let e3 = 0 | t2 % u;
        const n2 = _.__halfDigit(g - 2), o2 = a.__halfDigit(h + g - 2);
        for (; _JSBI.__imul(r2, n2) >>> 0 > (e3 << 16 | o2) >>> 0 && (r2--, e3 += u, !(32767 < e3)); ) ;
      }
      _JSBI.__internalMultiplyAdd(_, r2, 0, n, l);
      let e2 = a.__inplaceSub(l, h, g + 1);
      0 !== e2 && (e2 = a.__inplaceAdd(_, h, g), a.__setHalfDigit(h + g, 32767 & a.__halfDigit(h + g) + e2), r2--), t && (1 & h ? d = r2 << 15 : s.__setDigit(h >>> 1, d | r2));
    }
    if (e) return a.__inplaceRightShift(r), t ? { quotient: s, remainder: a } : a;
    if (t) return s;
    throw new Error("unreachable");
  }
  static __clz15(i) {
    return _JSBI.__clz30(i) - 15;
  }
  __inplaceAdd(_, t, e) {
    let n = 0;
    for (let g = 0; g < e; g++) {
      const i = this.__halfDigit(t + g) + _.__halfDigit(g) + n;
      n = i >>> 15, this.__setHalfDigit(t + g, 32767 & i);
    }
    return n;
  }
  __inplaceSub(_, t, e) {
    let n = 0;
    if (1 & t) {
      t >>= 1;
      let g = this.__digit(t), o = 32767 & g, s = 0;
      for (; s < e - 1 >>> 1; s++) {
        const i2 = _.__digit(s), e2 = (g >>> 15) - (32767 & i2) - n;
        n = 1 & e2 >>> 15, this.__setDigit(t + s, (32767 & e2) << 15 | 32767 & o), g = this.__digit(t + s + 1), o = (32767 & g) - (i2 >>> 15) - n, n = 1 & o >>> 15;
      }
      const i = _.__digit(s), l = (g >>> 15) - (32767 & i) - n;
      n = 1 & l >>> 15, this.__setDigit(t + s, (32767 & l) << 15 | 32767 & o);
      if (t + s + 1 >= this.length) throw new RangeError("out of bounds");
      0 == (1 & e) && (g = this.__digit(t + s + 1), o = (32767 & g) - (i >>> 15) - n, n = 1 & o >>> 15, this.__setDigit(t + _.length, 1073709056 & g | 32767 & o));
    } else {
      t >>= 1;
      let g = 0;
      for (; g < _.length - 1; g++) {
        const i2 = this.__digit(t + g), e2 = _.__digit(g), o2 = (32767 & i2) - (32767 & e2) - n;
        n = 1 & o2 >>> 15;
        const s2 = (i2 >>> 15) - (e2 >>> 15) - n;
        n = 1 & s2 >>> 15, this.__setDigit(t + g, (32767 & s2) << 15 | 32767 & o2);
      }
      const i = this.__digit(t + g), o = _.__digit(g), s = (32767 & i) - (32767 & o) - n;
      n = 1 & s >>> 15;
      let l = 0;
      0 == (1 & e) && (l = (i >>> 15) - (o >>> 15) - n, n = 1 & l >>> 15), this.__setDigit(t + g, (32767 & l) << 15 | 32767 & s);
    }
    return n;
  }
  __inplaceRightShift(_) {
    if (0 === _) return;
    let t = this.__digit(0) >>> _;
    const e = this.length - 1;
    for (let n = 0; n < e; n++) {
      const i = this.__digit(n + 1);
      this.__setDigit(n, 1073741823 & i << 30 - _ | t), t = i >>> _;
    }
    this.__setDigit(e, t);
  }
  static __specialLeftShift(_, t, e) {
    const g = _.length, n = new _JSBI(g + e, false);
    if (0 === t) {
      for (let t2 = 0; t2 < g; t2++) n.__setDigit(t2, _.__digit(t2));
      return 0 < e && n.__setDigit(g, 0), n;
    }
    let o = 0;
    for (let s = 0; s < g; s++) {
      const i = _.__digit(s);
      n.__setDigit(s, 1073741823 & i << t | o), o = i >>> 30 - t;
    }
    return 0 < e && n.__setDigit(g, o), n;
  }
  static __leftShiftByAbsolute(_, i) {
    const t = _JSBI.__toShiftAmount(i);
    if (0 > t) throw new RangeError("BigInt too big");
    const e = 0 | t / 30, n = t % 30, g = _.length, o = 0 !== n && 0 != _.__digit(g - 1) >>> 30 - n, s = g + e + (o ? 1 : 0), l = new _JSBI(s, _.sign);
    if (0 === n) {
      let t2 = 0;
      for (; t2 < e; t2++) l.__setDigit(t2, 0);
      for (; t2 < s; t2++) l.__setDigit(t2, _.__digit(t2 - e));
    } else {
      let t2 = 0;
      for (let _2 = 0; _2 < e; _2++) l.__setDigit(_2, 0);
      for (let o2 = 0; o2 < g; o2++) {
        const i2 = _.__digit(o2);
        l.__setDigit(o2 + e, 1073741823 & i2 << n | t2), t2 = i2 >>> 30 - n;
      }
      if (o) l.__setDigit(g + e, t2);
      else if (0 !== t2) throw new Error("implementation bug");
    }
    return l.__trim();
  }
  static __rightShiftByAbsolute(_, i) {
    const t = _.length, e = _.sign, n = _JSBI.__toShiftAmount(i);
    if (0 > n) return _JSBI.__rightShiftByMaximum(e);
    const g = 0 | n / 30, o = n % 30;
    let s = t - g;
    if (0 >= s) return _JSBI.__rightShiftByMaximum(e);
    let l = false;
    if (e) {
      if (0 != (_.__digit(g) & (1 << o) - 1)) l = true;
      else for (let t2 = 0; t2 < g; t2++) if (0 !== _.__digit(t2)) {
        l = true;
        break;
      }
    }
    if (l && 0 === o) {
      const i2 = _.__digit(t - 1);
      0 == ~i2 && s++;
    }
    let r = new _JSBI(s, e);
    if (0 === o) {
      r.__setDigit(s - 1, 0);
      for (let e2 = g; e2 < t; e2++) r.__setDigit(e2 - g, _.__digit(e2));
    } else {
      let e2 = _.__digit(g) >>> o;
      const n2 = t - g - 1;
      for (let t2 = 0; t2 < n2; t2++) {
        const i2 = _.__digit(t2 + g + 1);
        r.__setDigit(t2, 1073741823 & i2 << 30 - o | e2), e2 = i2 >>> o;
      }
      r.__setDigit(n2, e2);
    }
    return l && (r = _JSBI.__absoluteAddOne(r, true, r)), r.__trim();
  }
  static __rightShiftByMaximum(i) {
    return i ? _JSBI.__oneDigit(1, true) : _JSBI.__zero();
  }
  static __toShiftAmount(i) {
    if (1 < i.length) return -1;
    const _ = i.__unsignedDigit(0);
    return _ > _JSBI.__kMaxLengthBits ? -1 : _;
  }
  static __toPrimitive(i, _ = "default") {
    if ("object" != typeof i) return i;
    if (i.constructor === _JSBI) return i;
    if ("undefined" != typeof Symbol && "symbol" == typeof Symbol.toPrimitive) {
      const t2 = i[Symbol.toPrimitive];
      if (t2) {
        const i2 = t2(_);
        if ("object" != typeof i2) return i2;
        throw new TypeError("Cannot convert object to primitive value");
      }
    }
    const t = i.valueOf;
    if (t) {
      const _2 = t.call(i);
      if ("object" != typeof _2) return _2;
    }
    const e = i.toString;
    if (e) {
      const _2 = e.call(i);
      if ("object" != typeof _2) return _2;
    }
    throw new TypeError("Cannot convert object to primitive value");
  }
  static __toNumeric(i) {
    return _JSBI.__isBigInt(i) ? i : +i;
  }
  static __isBigInt(i) {
    return "object" == typeof i && null !== i && i.constructor === _JSBI;
  }
  static __truncateToNBits(i, _) {
    const t = 0 | (i + 29) / 30, e = new _JSBI(t, _.sign), n = t - 1;
    for (let t2 = 0; t2 < n; t2++) e.__setDigit(t2, _.__digit(t2));
    let g = _.__digit(n);
    if (0 != i % 30) {
      const _2 = 32 - i % 30;
      g = g << _2 >>> _2;
    }
    return e.__setDigit(n, g), e.__trim();
  }
  static __truncateAndSubFromPowerOfTwo(_, t, e) {
    var n = Math.min;
    const g = 0 | (_ + 29) / 30, o = new _JSBI(g, e);
    let s = 0;
    const l = g - 1;
    let a = 0;
    for (const i = n(l, t.length); s < i; s++) {
      const i2 = 0 - t.__digit(s) - a;
      a = 1 & i2 >>> 30, o.__setDigit(s, 1073741823 & i2);
    }
    for (; s < l; s++) o.__setDigit(s, 0 | 1073741823 & -a);
    let u = l < t.length ? t.__digit(l) : 0;
    const d = _ % 30;
    let h;
    if (0 == d) h = 0 - u - a, h &= 1073741823;
    else {
      const i = 32 - d;
      u = u << i >>> i;
      const _2 = 1 << 32 - i;
      h = _2 - u - a, h &= _2 - 1;
    }
    return o.__setDigit(l, h), o.__trim();
  }
  __digit(_) {
    return this[_];
  }
  __unsignedDigit(_) {
    return this[_] >>> 0;
  }
  __setDigit(_, i) {
    this[_] = 0 | i;
  }
  __setDigitGrow(_, i) {
    this[_] = 0 | i;
  }
  __halfDigitLength() {
    const i = this.length;
    return 32767 >= this.__unsignedDigit(i - 1) ? 2 * i - 1 : 2 * i;
  }
  __halfDigit(_) {
    return 32767 & this[_ >>> 1] >>> 15 * (1 & _);
  }
  __setHalfDigit(_, i) {
    const t = _ >>> 1, e = this.__digit(t), n = 1 & _ ? 32767 & e | i << 15 : 1073709056 & e | 32767 & i;
    this.__setDigit(t, n);
  }
  static __digitPow(i, _) {
    let t = 1;
    for (; 0 < _; ) 1 & _ && (t *= i), _ >>>= 1, i *= i;
    return t;
  }
  static __isOneDigitInt(i) {
    return (1073741823 & i) === i;
  }
};
JSBI.__kMaxLength = 33554432, JSBI.__kMaxLengthBits = JSBI.__kMaxLength << 5, JSBI.__kMaxBitsPerChar = [0, 0, 32, 51, 64, 75, 83, 90, 96, 102, 107, 111, 115, 119, 122, 126, 128, 131, 134, 136, 139, 141, 143, 145, 147, 149, 151, 153, 154, 156, 158, 159, 160, 162, 163, 165, 166], JSBI.__kBitsPerCharTableShift = 5, JSBI.__kBitsPerCharTableMultiplier = 1 << JSBI.__kBitsPerCharTableShift, JSBI.__kConversionChars = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"], JSBI.__kBitConversionBuffer = new ArrayBuffer(8), JSBI.__kBitConversionDouble = new Float64Array(JSBI.__kBitConversionBuffer), JSBI.__kBitConversionInts = new Int32Array(JSBI.__kBitConversionBuffer), JSBI.__clz30 = Math.clz32 ? function(i) {
  return Math.clz32(i) - 2;
} : function(i) {
  return 0 === i ? 30 : 0 | 29 - (0 | Math.log(i >>> 0) / Math.LN2);
}, JSBI.__imul = Math.imul || function(i, _) {
  return 0 | i * _;
};
var jsbi_default = JSBI;

// ../../node_modules/tiny-invariant/dist/esm/tiny-invariant.js
var isProduction = process.env.NODE_ENV === "production";
var prefix = "Invariant failed";
function invariant(condition, message) {
  if (condition) {
    return;
  }
  if (isProduction) {
    throw new Error(prefix);
  }
  var provided = typeof message === "function" ? message() : message;
  var value = provided ? "".concat(prefix, ": ").concat(provided) : prefix;
  throw new Error(value);
}

// ../../node_modules/@ethersproject/bignumber/lib.esm/bignumber.js
var import_bn = __toESM(require_bn());

// ../../node_modules/@ethersproject/logger/lib.esm/_version.js
var version = "logger/5.7.0";

// ../../node_modules/@ethersproject/logger/lib.esm/index.js
var _permanentCensorErrors = false;
var _censorErrors = false;
var LogLevels = { debug: 1, "default": 2, info: 2, warning: 3, error: 4, off: 5 };
var _logLevel = LogLevels["default"];
var _globalLogger = null;
function _checkNormalize() {
  try {
    const missing = [];
    ["NFD", "NFC", "NFKD", "NFKC"].forEach((form) => {
      try {
        if ("test".normalize(form) !== "test") {
          throw new Error("bad normalize");
        }
        ;
      } catch (error) {
        missing.push(form);
      }
    });
    if (missing.length) {
      throw new Error("missing " + missing.join(", "));
    }
    if (String.fromCharCode(233).normalize("NFD") !== String.fromCharCode(101, 769)) {
      throw new Error("broken implementation");
    }
  } catch (error) {
    return error.message;
  }
  return null;
}
var _normalizeError = _checkNormalize();
var LogLevel;
(function(LogLevel2) {
  LogLevel2["DEBUG"] = "DEBUG";
  LogLevel2["INFO"] = "INFO";
  LogLevel2["WARNING"] = "WARNING";
  LogLevel2["ERROR"] = "ERROR";
  LogLevel2["OFF"] = "OFF";
})(LogLevel || (LogLevel = {}));
var ErrorCode;
(function(ErrorCode2) {
  ErrorCode2["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
  ErrorCode2["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
  ErrorCode2["UNSUPPORTED_OPERATION"] = "UNSUPPORTED_OPERATION";
  ErrorCode2["NETWORK_ERROR"] = "NETWORK_ERROR";
  ErrorCode2["SERVER_ERROR"] = "SERVER_ERROR";
  ErrorCode2["TIMEOUT"] = "TIMEOUT";
  ErrorCode2["BUFFER_OVERRUN"] = "BUFFER_OVERRUN";
  ErrorCode2["NUMERIC_FAULT"] = "NUMERIC_FAULT";
  ErrorCode2["MISSING_NEW"] = "MISSING_NEW";
  ErrorCode2["INVALID_ARGUMENT"] = "INVALID_ARGUMENT";
  ErrorCode2["MISSING_ARGUMENT"] = "MISSING_ARGUMENT";
  ErrorCode2["UNEXPECTED_ARGUMENT"] = "UNEXPECTED_ARGUMENT";
  ErrorCode2["CALL_EXCEPTION"] = "CALL_EXCEPTION";
  ErrorCode2["INSUFFICIENT_FUNDS"] = "INSUFFICIENT_FUNDS";
  ErrorCode2["NONCE_EXPIRED"] = "NONCE_EXPIRED";
  ErrorCode2["REPLACEMENT_UNDERPRICED"] = "REPLACEMENT_UNDERPRICED";
  ErrorCode2["UNPREDICTABLE_GAS_LIMIT"] = "UNPREDICTABLE_GAS_LIMIT";
  ErrorCode2["TRANSACTION_REPLACED"] = "TRANSACTION_REPLACED";
  ErrorCode2["ACTION_REJECTED"] = "ACTION_REJECTED";
})(ErrorCode || (ErrorCode = {}));
var HEX = "0123456789abcdef";
var Logger = class _Logger {
  constructor(version9) {
    Object.defineProperty(this, "version", {
      enumerable: true,
      value: version9,
      writable: false
    });
  }
  _log(logLevel, args) {
    const level = logLevel.toLowerCase();
    if (LogLevels[level] == null) {
      this.throwArgumentError("invalid log level name", "logLevel", logLevel);
    }
    if (_logLevel > LogLevels[level]) {
      return;
    }
    console.log.apply(console, args);
  }
  debug(...args) {
    this._log(_Logger.levels.DEBUG, args);
  }
  info(...args) {
    this._log(_Logger.levels.INFO, args);
  }
  warn(...args) {
    this._log(_Logger.levels.WARNING, args);
  }
  makeError(message, code, params) {
    if (_censorErrors) {
      return this.makeError("censored error", code, {});
    }
    if (!code) {
      code = _Logger.errors.UNKNOWN_ERROR;
    }
    if (!params) {
      params = {};
    }
    const messageDetails = [];
    Object.keys(params).forEach((key) => {
      const value = params[key];
      try {
        if (value instanceof Uint8Array) {
          let hex = "";
          for (let i = 0; i < value.length; i++) {
            hex += HEX[value[i] >> 4];
            hex += HEX[value[i] & 15];
          }
          messageDetails.push(key + "=Uint8Array(0x" + hex + ")");
        } else {
          messageDetails.push(key + "=" + JSON.stringify(value));
        }
      } catch (error2) {
        messageDetails.push(key + "=" + JSON.stringify(params[key].toString()));
      }
    });
    messageDetails.push(`code=${code}`);
    messageDetails.push(`version=${this.version}`);
    const reason = message;
    let url = "";
    switch (code) {
      case ErrorCode.NUMERIC_FAULT: {
        url = "NUMERIC_FAULT";
        const fault = message;
        switch (fault) {
          case "overflow":
          case "underflow":
          case "division-by-zero":
            url += "-" + fault;
            break;
          case "negative-power":
          case "negative-width":
            url += "-unsupported";
            break;
          case "unbound-bitwise-result":
            url += "-unbound-result";
            break;
        }
        break;
      }
      case ErrorCode.CALL_EXCEPTION:
      case ErrorCode.INSUFFICIENT_FUNDS:
      case ErrorCode.MISSING_NEW:
      case ErrorCode.NONCE_EXPIRED:
      case ErrorCode.REPLACEMENT_UNDERPRICED:
      case ErrorCode.TRANSACTION_REPLACED:
      case ErrorCode.UNPREDICTABLE_GAS_LIMIT:
        url = code;
        break;
    }
    if (url) {
      message += " [ See: https://links.ethers.org/v5-errors-" + url + " ]";
    }
    if (messageDetails.length) {
      message += " (" + messageDetails.join(", ") + ")";
    }
    const error = new Error(message);
    error.reason = reason;
    error.code = code;
    Object.keys(params).forEach(function(key) {
      error[key] = params[key];
    });
    return error;
  }
  throwError(message, code, params) {
    throw this.makeError(message, code, params);
  }
  throwArgumentError(message, name, value) {
    return this.throwError(message, _Logger.errors.INVALID_ARGUMENT, {
      argument: name,
      value
    });
  }
  assert(condition, message, code, params) {
    if (!!condition) {
      return;
    }
    this.throwError(message, code, params);
  }
  assertArgument(condition, message, name, value) {
    if (!!condition) {
      return;
    }
    this.throwArgumentError(message, name, value);
  }
  checkNormalize(message) {
    if (message == null) {
      message = "platform missing String.prototype.normalize";
    }
    if (_normalizeError) {
      this.throwError("platform missing String.prototype.normalize", _Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "String.prototype.normalize",
        form: _normalizeError
      });
    }
  }
  checkSafeUint53(value, message) {
    if (typeof value !== "number") {
      return;
    }
    if (message == null) {
      message = "value not safe";
    }
    if (value < 0 || value >= 9007199254740991) {
      this.throwError(message, _Logger.errors.NUMERIC_FAULT, {
        operation: "checkSafeInteger",
        fault: "out-of-safe-range",
        value
      });
    }
    if (value % 1) {
      this.throwError(message, _Logger.errors.NUMERIC_FAULT, {
        operation: "checkSafeInteger",
        fault: "non-integer",
        value
      });
    }
  }
  checkArgumentCount(count, expectedCount, message) {
    if (message) {
      message = ": " + message;
    } else {
      message = "";
    }
    if (count < expectedCount) {
      this.throwError("missing argument" + message, _Logger.errors.MISSING_ARGUMENT, {
        count,
        expectedCount
      });
    }
    if (count > expectedCount) {
      this.throwError("too many arguments" + message, _Logger.errors.UNEXPECTED_ARGUMENT, {
        count,
        expectedCount
      });
    }
  }
  checkNew(target, kind) {
    if (target === Object || target == null) {
      this.throwError("missing new", _Logger.errors.MISSING_NEW, { name: kind.name });
    }
  }
  checkAbstract(target, kind) {
    if (target === kind) {
      this.throwError("cannot instantiate abstract class " + JSON.stringify(kind.name) + " directly; use a sub-class", _Logger.errors.UNSUPPORTED_OPERATION, { name: target.name, operation: "new" });
    } else if (target === Object || target == null) {
      this.throwError("missing new", _Logger.errors.MISSING_NEW, { name: kind.name });
    }
  }
  static globalLogger() {
    if (!_globalLogger) {
      _globalLogger = new _Logger(version);
    }
    return _globalLogger;
  }
  static setCensorship(censorship, permanent) {
    if (!censorship && permanent) {
      this.globalLogger().throwError("cannot permanently disable censorship", _Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "setCensorship"
      });
    }
    if (_permanentCensorErrors) {
      if (!censorship) {
        return;
      }
      this.globalLogger().throwError("error censorship permanent", _Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "setCensorship"
      });
    }
    _censorErrors = !!censorship;
    _permanentCensorErrors = !!permanent;
  }
  static setLogLevel(logLevel) {
    const level = LogLevels[logLevel.toLowerCase()];
    if (level == null) {
      _Logger.globalLogger().warn("invalid log level - " + logLevel);
      return;
    }
    _logLevel = level;
  }
  static from(version9) {
    return new _Logger(version9);
  }
};
Logger.errors = ErrorCode;
Logger.levels = LogLevel;

// ../../node_modules/@ethersproject/bytes/lib.esm/_version.js
var version2 = "bytes/5.7.0";

// ../../node_modules/@ethersproject/bytes/lib.esm/index.js
var logger = new Logger(version2);
function isHexable(value) {
  return !!value.toHexString;
}
function addSlice(array) {
  if (array.slice) {
    return array;
  }
  array.slice = function() {
    const args = Array.prototype.slice.call(arguments);
    return addSlice(new Uint8Array(Array.prototype.slice.apply(array, args)));
  };
  return array;
}
function isInteger(value) {
  return typeof value === "number" && value == value && value % 1 === 0;
}
function isBytes(value) {
  if (value == null) {
    return false;
  }
  if (value.constructor === Uint8Array) {
    return true;
  }
  if (typeof value === "string") {
    return false;
  }
  if (!isInteger(value.length) || value.length < 0) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const v = value[i];
    if (!isInteger(v) || v < 0 || v >= 256) {
      return false;
    }
  }
  return true;
}
function arrayify(value, options) {
  if (!options) {
    options = {};
  }
  if (typeof value === "number") {
    logger.checkSafeUint53(value, "invalid arrayify value");
    const result = [];
    while (value) {
      result.unshift(value & 255);
      value = parseInt(String(value / 256));
    }
    if (result.length === 0) {
      result.push(0);
    }
    return addSlice(new Uint8Array(result));
  }
  if (options.allowMissingPrefix && typeof value === "string" && value.substring(0, 2) !== "0x") {
    value = "0x" + value;
  }
  if (isHexable(value)) {
    value = value.toHexString();
  }
  if (isHexString(value)) {
    let hex = value.substring(2);
    if (hex.length % 2) {
      if (options.hexPad === "left") {
        hex = "0" + hex;
      } else if (options.hexPad === "right") {
        hex += "0";
      } else {
        logger.throwArgumentError("hex data is odd-length", "value", value);
      }
    }
    const result = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return addSlice(new Uint8Array(result));
  }
  if (isBytes(value)) {
    return addSlice(new Uint8Array(value));
  }
  return logger.throwArgumentError("invalid arrayify value", "value", value);
}
function concat(items) {
  const objects = items.map((item) => arrayify(item));
  const length = objects.reduce((accum, item) => accum + item.length, 0);
  const result = new Uint8Array(length);
  objects.reduce((offset, object) => {
    result.set(object, offset);
    return offset + object.length;
  }, 0);
  return addSlice(result);
}
function zeroPad(value, length) {
  value = arrayify(value);
  if (value.length > length) {
    logger.throwArgumentError("value out of range", "value", arguments[0]);
  }
  const result = new Uint8Array(length);
  result.set(value, length - value.length);
  return addSlice(result);
}
function isHexString(value, length) {
  if (typeof value !== "string" || !value.match(/^0x[0-9A-Fa-f]*$/)) {
    return false;
  }
  if (length && value.length !== 2 + 2 * length) {
    return false;
  }
  return true;
}
var HexCharacters = "0123456789abcdef";
function hexlify(value, options) {
  if (!options) {
    options = {};
  }
  if (typeof value === "number") {
    logger.checkSafeUint53(value, "invalid hexlify value");
    let hex = "";
    while (value) {
      hex = HexCharacters[value & 15] + hex;
      value = Math.floor(value / 16);
    }
    if (hex.length) {
      if (hex.length % 2) {
        hex = "0" + hex;
      }
      return "0x" + hex;
    }
    return "0x00";
  }
  if (typeof value === "bigint") {
    value = value.toString(16);
    if (value.length % 2) {
      return "0x0" + value;
    }
    return "0x" + value;
  }
  if (options.allowMissingPrefix && typeof value === "string" && value.substring(0, 2) !== "0x") {
    value = "0x" + value;
  }
  if (isHexable(value)) {
    return value.toHexString();
  }
  if (isHexString(value)) {
    if (value.length % 2) {
      if (options.hexPad === "left") {
        value = "0x0" + value.substring(2);
      } else if (options.hexPad === "right") {
        value += "0";
      } else {
        logger.throwArgumentError("hex data is odd-length", "value", value);
      }
    }
    return value.toLowerCase();
  }
  if (isBytes(value)) {
    let result = "0x";
    for (let i = 0; i < value.length; i++) {
      let v = value[i];
      result += HexCharacters[(v & 240) >> 4] + HexCharacters[v & 15];
    }
    return result;
  }
  return logger.throwArgumentError("invalid hexlify value", "value", value);
}
function hexDataLength(data) {
  if (typeof data !== "string") {
    data = hexlify(data);
  } else if (!isHexString(data) || data.length % 2) {
    return null;
  }
  return (data.length - 2) / 2;
}
function hexDataSlice(data, offset, endOffset) {
  if (typeof data !== "string") {
    data = hexlify(data);
  } else if (!isHexString(data) || data.length % 2) {
    logger.throwArgumentError("invalid hexData", "value", data);
  }
  offset = 2 + 2 * offset;
  if (endOffset != null) {
    return "0x" + data.substring(offset, 2 + 2 * endOffset);
  }
  return "0x" + data.substring(offset);
}
function hexConcat(items) {
  let result = "0x";
  items.forEach((item) => {
    result += hexlify(item).substring(2);
  });
  return result;
}
function hexZeroPad(value, length) {
  if (typeof value !== "string") {
    value = hexlify(value);
  } else if (!isHexString(value)) {
    logger.throwArgumentError("invalid hex string", "value", value);
  }
  if (value.length > 2 * length + 2) {
    logger.throwArgumentError("value out of range", "value", arguments[1]);
  }
  while (value.length < 2 * length + 2) {
    value = "0x0" + value.substring(2);
  }
  return value;
}

// ../../node_modules/@ethersproject/bignumber/lib.esm/_version.js
var version3 = "bignumber/5.7.0";

// ../../node_modules/@ethersproject/bignumber/lib.esm/bignumber.js
var BN = import_bn.default.BN;
var logger2 = new Logger(version3);
var _constructorGuard = {};
var MAX_SAFE = 9007199254740991;
var _warnedToStringRadix = false;
var BigNumber = class _BigNumber {
  constructor(constructorGuard, hex) {
    if (constructorGuard !== _constructorGuard) {
      logger2.throwError("cannot call constructor directly; use BigNumber.from", Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "new (BigNumber)"
      });
    }
    this._hex = hex;
    this._isBigNumber = true;
    Object.freeze(this);
  }
  fromTwos(value) {
    return toBigNumber(toBN(this).fromTwos(value));
  }
  toTwos(value) {
    return toBigNumber(toBN(this).toTwos(value));
  }
  abs() {
    if (this._hex[0] === "-") {
      return _BigNumber.from(this._hex.substring(1));
    }
    return this;
  }
  add(other) {
    return toBigNumber(toBN(this).add(toBN(other)));
  }
  sub(other) {
    return toBigNumber(toBN(this).sub(toBN(other)));
  }
  div(other) {
    const o = _BigNumber.from(other);
    if (o.isZero()) {
      throwFault("division-by-zero", "div");
    }
    return toBigNumber(toBN(this).div(toBN(other)));
  }
  mul(other) {
    return toBigNumber(toBN(this).mul(toBN(other)));
  }
  mod(other) {
    const value = toBN(other);
    if (value.isNeg()) {
      throwFault("division-by-zero", "mod");
    }
    return toBigNumber(toBN(this).umod(value));
  }
  pow(other) {
    const value = toBN(other);
    if (value.isNeg()) {
      throwFault("negative-power", "pow");
    }
    return toBigNumber(toBN(this).pow(value));
  }
  and(other) {
    const value = toBN(other);
    if (this.isNegative() || value.isNeg()) {
      throwFault("unbound-bitwise-result", "and");
    }
    return toBigNumber(toBN(this).and(value));
  }
  or(other) {
    const value = toBN(other);
    if (this.isNegative() || value.isNeg()) {
      throwFault("unbound-bitwise-result", "or");
    }
    return toBigNumber(toBN(this).or(value));
  }
  xor(other) {
    const value = toBN(other);
    if (this.isNegative() || value.isNeg()) {
      throwFault("unbound-bitwise-result", "xor");
    }
    return toBigNumber(toBN(this).xor(value));
  }
  mask(value) {
    if (this.isNegative() || value < 0) {
      throwFault("negative-width", "mask");
    }
    return toBigNumber(toBN(this).maskn(value));
  }
  shl(value) {
    if (this.isNegative() || value < 0) {
      throwFault("negative-width", "shl");
    }
    return toBigNumber(toBN(this).shln(value));
  }
  shr(value) {
    if (this.isNegative() || value < 0) {
      throwFault("negative-width", "shr");
    }
    return toBigNumber(toBN(this).shrn(value));
  }
  eq(other) {
    return toBN(this).eq(toBN(other));
  }
  lt(other) {
    return toBN(this).lt(toBN(other));
  }
  lte(other) {
    return toBN(this).lte(toBN(other));
  }
  gt(other) {
    return toBN(this).gt(toBN(other));
  }
  gte(other) {
    return toBN(this).gte(toBN(other));
  }
  isNegative() {
    return this._hex[0] === "-";
  }
  isZero() {
    return toBN(this).isZero();
  }
  toNumber() {
    try {
      return toBN(this).toNumber();
    } catch (error) {
      throwFault("overflow", "toNumber", this.toString());
    }
    return null;
  }
  toBigInt() {
    try {
      return BigInt(this.toString());
    } catch (e) {
    }
    return logger2.throwError("this platform does not support BigInt", Logger.errors.UNSUPPORTED_OPERATION, {
      value: this.toString()
    });
  }
  toString() {
    if (arguments.length > 0) {
      if (arguments[0] === 10) {
        if (!_warnedToStringRadix) {
          _warnedToStringRadix = true;
          logger2.warn("BigNumber.toString does not accept any parameters; base-10 is assumed");
        }
      } else if (arguments[0] === 16) {
        logger2.throwError("BigNumber.toString does not accept any parameters; use bigNumber.toHexString()", Logger.errors.UNEXPECTED_ARGUMENT, {});
      } else {
        logger2.throwError("BigNumber.toString does not accept parameters", Logger.errors.UNEXPECTED_ARGUMENT, {});
      }
    }
    return toBN(this).toString(10);
  }
  toHexString() {
    return this._hex;
  }
  toJSON(key) {
    return { type: "BigNumber", hex: this.toHexString() };
  }
  static from(value) {
    if (value instanceof _BigNumber) {
      return value;
    }
    if (typeof value === "string") {
      if (value.match(/^-?0x[0-9a-f]+$/i)) {
        return new _BigNumber(_constructorGuard, toHex2(value));
      }
      if (value.match(/^-?[0-9]+$/)) {
        return new _BigNumber(_constructorGuard, toHex2(new BN(value)));
      }
      return logger2.throwArgumentError("invalid BigNumber string", "value", value);
    }
    if (typeof value === "number") {
      if (value % 1) {
        throwFault("underflow", "BigNumber.from", value);
      }
      if (value >= MAX_SAFE || value <= -MAX_SAFE) {
        throwFault("overflow", "BigNumber.from", value);
      }
      return _BigNumber.from(String(value));
    }
    const anyValue = value;
    if (typeof anyValue === "bigint") {
      return _BigNumber.from(anyValue.toString());
    }
    if (isBytes(anyValue)) {
      return _BigNumber.from(hexlify(anyValue));
    }
    if (anyValue) {
      if (anyValue.toHexString) {
        const hex = anyValue.toHexString();
        if (typeof hex === "string") {
          return _BigNumber.from(hex);
        }
      } else {
        let hex = anyValue._hex;
        if (hex == null && anyValue.type === "BigNumber") {
          hex = anyValue.hex;
        }
        if (typeof hex === "string") {
          if (isHexString(hex) || hex[0] === "-" && isHexString(hex.substring(1))) {
            return _BigNumber.from(hex);
          }
        }
      }
    }
    return logger2.throwArgumentError("invalid BigNumber value", "value", value);
  }
  static isBigNumber(value) {
    return !!(value && value._isBigNumber);
  }
};
function toHex2(value) {
  if (typeof value !== "string") {
    return toHex2(value.toString(16));
  }
  if (value[0] === "-") {
    value = value.substring(1);
    if (value[0] === "-") {
      logger2.throwArgumentError("invalid hex", "value", value);
    }
    value = toHex2(value);
    if (value === "0x00") {
      return value;
    }
    return "-" + value;
  }
  if (value.substring(0, 2) !== "0x") {
    value = "0x" + value;
  }
  if (value === "0x") {
    return "0x00";
  }
  if (value.length % 2) {
    value = "0x0" + value.substring(2);
  }
  while (value.length > 4 && value.substring(0, 4) === "0x00") {
    value = "0x" + value.substring(4);
  }
  return value;
}
function toBigNumber(value) {
  return BigNumber.from(toHex2(value));
}
function toBN(value) {
  const hex = BigNumber.from(value).toHexString();
  if (hex[0] === "-") {
    return new BN("-" + hex.substring(3), 16);
  }
  return new BN(hex.substring(2), 16);
}
function throwFault(fault, operation, value) {
  const params = { fault, operation };
  if (value != null) {
    params.value = value;
  }
  return logger2.throwError(fault, Logger.errors.NUMERIC_FAULT, params);
}
function _base36To16(value) {
  return new BN(value, 36).toString(16);
}

// ../../node_modules/@ethersproject/properties/lib.esm/_version.js
var version4 = "properties/5.7.0";

// ../../node_modules/@ethersproject/properties/lib.esm/index.js
var logger3 = new Logger(version4);
function defineReadOnly(object, name, value) {
  Object.defineProperty(object, name, {
    enumerable: true,
    value,
    writable: false
  });
}
function getStatic(ctor, key) {
  for (let i = 0; i < 32; i++) {
    if (ctor[key]) {
      return ctor[key];
    }
    if (!ctor.prototype || typeof ctor.prototype !== "object") {
      break;
    }
    ctor = Object.getPrototypeOf(ctor.prototype).constructor;
  }
  return null;
}
var opaque = { bigint: true, boolean: true, "function": true, number: true, string: true };
function _isFrozen(object) {
  if (object === void 0 || object === null || opaque[typeof object]) {
    return true;
  }
  if (Array.isArray(object) || typeof object === "object") {
    if (!Object.isFrozen(object)) {
      return false;
    }
    const keys = Object.keys(object);
    for (let i = 0; i < keys.length; i++) {
      let value = null;
      try {
        value = object[keys[i]];
      } catch (error) {
        continue;
      }
      if (!_isFrozen(value)) {
        return false;
      }
    }
    return true;
  }
  return logger3.throwArgumentError(`Cannot deepCopy ${typeof object}`, "object", object);
}
function _deepCopy(object) {
  if (_isFrozen(object)) {
    return object;
  }
  if (Array.isArray(object)) {
    return Object.freeze(object.map((item) => deepCopy(item)));
  }
  if (typeof object === "object") {
    const result = {};
    for (const key in object) {
      const value = object[key];
      if (value === void 0) {
        continue;
      }
      defineReadOnly(result, key, deepCopy(value));
    }
    return result;
  }
  return logger3.throwArgumentError(`Cannot deepCopy ${typeof object}`, "object", object);
}
function deepCopy(object) {
  return _deepCopy(object);
}
var Description = class {
  constructor(info) {
    for (const key in info) {
      this[key] = deepCopy(info[key]);
    }
  }
};

// ../../node_modules/@ethersproject/abi/lib.esm/_version.js
var version5 = "abi/5.7.0";

// ../../node_modules/@ethersproject/abi/lib.esm/fragments.js
var logger4 = new Logger(version5);
var _constructorGuard2 = {};
var ModifiersBytes = { calldata: true, memory: true, storage: true };
var ModifiersNest = { calldata: true, memory: true };
function checkModifier(type, name) {
  if (type === "bytes" || type === "string") {
    if (ModifiersBytes[name]) {
      return true;
    }
  } else if (type === "address") {
    if (name === "payable") {
      return true;
    }
  } else if (type.indexOf("[") >= 0 || type === "tuple") {
    if (ModifiersNest[name]) {
      return true;
    }
  }
  if (ModifiersBytes[name] || name === "payable") {
    logger4.throwArgumentError("invalid modifier", "name", name);
  }
  return false;
}
function parseParamType(param, allowIndexed) {
  let originalParam = param;
  function throwError(i) {
    logger4.throwArgumentError(`unexpected character at position ${i}`, "param", param);
  }
  param = param.replace(/\s/g, " ");
  function newNode(parent2) {
    let node2 = { type: "", name: "", parent: parent2, state: { allowType: true } };
    if (allowIndexed) {
      node2.indexed = false;
    }
    return node2;
  }
  let parent = { type: "", name: "", state: { allowType: true } };
  let node = parent;
  for (let i = 0; i < param.length; i++) {
    let c = param[i];
    switch (c) {
      case "(":
        if (node.state.allowType && node.type === "") {
          node.type = "tuple";
        } else if (!node.state.allowParams) {
          throwError(i);
        }
        node.state.allowType = false;
        node.type = verifyType(node.type);
        node.components = [newNode(node)];
        node = node.components[0];
        break;
      case ")":
        delete node.state;
        if (node.name === "indexed") {
          if (!allowIndexed) {
            throwError(i);
          }
          node.indexed = true;
          node.name = "";
        }
        if (checkModifier(node.type, node.name)) {
          node.name = "";
        }
        node.type = verifyType(node.type);
        let child = node;
        node = node.parent;
        if (!node) {
          throwError(i);
        }
        delete child.parent;
        node.state.allowParams = false;
        node.state.allowName = true;
        node.state.allowArray = true;
        break;
      case ",":
        delete node.state;
        if (node.name === "indexed") {
          if (!allowIndexed) {
            throwError(i);
          }
          node.indexed = true;
          node.name = "";
        }
        if (checkModifier(node.type, node.name)) {
          node.name = "";
        }
        node.type = verifyType(node.type);
        let sibling = newNode(node.parent);
        node.parent.components.push(sibling);
        delete node.parent;
        node = sibling;
        break;
      // Hit a space...
      case " ":
        if (node.state.allowType) {
          if (node.type !== "") {
            node.type = verifyType(node.type);
            delete node.state.allowType;
            node.state.allowName = true;
            node.state.allowParams = true;
          }
        }
        if (node.state.allowName) {
          if (node.name !== "") {
            if (node.name === "indexed") {
              if (!allowIndexed) {
                throwError(i);
              }
              if (node.indexed) {
                throwError(i);
              }
              node.indexed = true;
              node.name = "";
            } else if (checkModifier(node.type, node.name)) {
              node.name = "";
            } else {
              node.state.allowName = false;
            }
          }
        }
        break;
      case "[":
        if (!node.state.allowArray) {
          throwError(i);
        }
        node.type += c;
        node.state.allowArray = false;
        node.state.allowName = false;
        node.state.readArray = true;
        break;
      case "]":
        if (!node.state.readArray) {
          throwError(i);
        }
        node.type += c;
        node.state.readArray = false;
        node.state.allowArray = true;
        node.state.allowName = true;
        break;
      default:
        if (node.state.allowType) {
          node.type += c;
          node.state.allowParams = true;
          node.state.allowArray = true;
        } else if (node.state.allowName) {
          node.name += c;
          delete node.state.allowArray;
        } else if (node.state.readArray) {
          node.type += c;
        } else {
          throwError(i);
        }
    }
  }
  if (node.parent) {
    logger4.throwArgumentError("unexpected eof", "param", param);
  }
  delete parent.state;
  if (node.name === "indexed") {
    if (!allowIndexed) {
      throwError(originalParam.length - 7);
    }
    if (node.indexed) {
      throwError(originalParam.length - 7);
    }
    node.indexed = true;
    node.name = "";
  } else if (checkModifier(node.type, node.name)) {
    node.name = "";
  }
  parent.type = verifyType(parent.type);
  return parent;
}
function populate(object, params) {
  for (let key in params) {
    defineReadOnly(object, key, params[key]);
  }
}
var FormatTypes = Object.freeze({
  // Bare formatting, as is needed for computing a sighash of an event or function
  sighash: "sighash",
  // Human-Readable with Minimal spacing and without names (compact human-readable)
  minimal: "minimal",
  // Human-Readable with nice spacing, including all names
  full: "full",
  // JSON-format a la Solidity
  json: "json"
});
var paramTypeArray = new RegExp(/^(.*)\[([0-9]*)\]$/);
var ParamType = class _ParamType {
  constructor(constructorGuard, params) {
    if (constructorGuard !== _constructorGuard2) {
      logger4.throwError("use fromString", Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "new ParamType()"
      });
    }
    populate(this, params);
    let match = this.type.match(paramTypeArray);
    if (match) {
      populate(this, {
        arrayLength: parseInt(match[2] || "-1"),
        arrayChildren: _ParamType.fromObject({
          type: match[1],
          components: this.components
        }),
        baseType: "array"
      });
    } else {
      populate(this, {
        arrayLength: null,
        arrayChildren: null,
        baseType: this.components != null ? "tuple" : this.type
      });
    }
    this._isParamType = true;
    Object.freeze(this);
  }
  // Format the parameter fragment
  //   - sighash: "(uint256,address)"
  //   - minimal: "tuple(uint256,address) indexed"
  //   - full:    "tuple(uint256 foo, address bar) indexed baz"
  format(format) {
    if (!format) {
      format = FormatTypes.sighash;
    }
    if (!FormatTypes[format]) {
      logger4.throwArgumentError("invalid format type", "format", format);
    }
    if (format === FormatTypes.json) {
      let result2 = {
        type: this.baseType === "tuple" ? "tuple" : this.type,
        name: this.name || void 0
      };
      if (typeof this.indexed === "boolean") {
        result2.indexed = this.indexed;
      }
      if (this.components) {
        result2.components = this.components.map((comp) => JSON.parse(comp.format(format)));
      }
      return JSON.stringify(result2);
    }
    let result = "";
    if (this.baseType === "array") {
      result += this.arrayChildren.format(format);
      result += "[" + (this.arrayLength < 0 ? "" : String(this.arrayLength)) + "]";
    } else {
      if (this.baseType === "tuple") {
        if (format !== FormatTypes.sighash) {
          result += this.type;
        }
        result += "(" + this.components.map((comp) => comp.format(format)).join(format === FormatTypes.full ? ", " : ",") + ")";
      } else {
        result += this.type;
      }
    }
    if (format !== FormatTypes.sighash) {
      if (this.indexed === true) {
        result += " indexed";
      }
      if (format === FormatTypes.full && this.name) {
        result += " " + this.name;
      }
    }
    return result;
  }
  static from(value, allowIndexed) {
    if (typeof value === "string") {
      return _ParamType.fromString(value, allowIndexed);
    }
    return _ParamType.fromObject(value);
  }
  static fromObject(value) {
    if (_ParamType.isParamType(value)) {
      return value;
    }
    return new _ParamType(_constructorGuard2, {
      name: value.name || null,
      type: verifyType(value.type),
      indexed: value.indexed == null ? null : !!value.indexed,
      components: value.components ? value.components.map(_ParamType.fromObject) : null
    });
  }
  static fromString(value, allowIndexed) {
    function ParamTypify(node) {
      return _ParamType.fromObject({
        name: node.name,
        type: node.type,
        indexed: node.indexed,
        components: node.components
      });
    }
    return ParamTypify(parseParamType(value, !!allowIndexed));
  }
  static isParamType(value) {
    return !!(value != null && value._isParamType);
  }
};
function parseParams(value, allowIndex) {
  return splitNesting(value).map((param) => ParamType.fromString(param, allowIndex));
}
var Fragment = class _Fragment {
  constructor(constructorGuard, params) {
    if (constructorGuard !== _constructorGuard2) {
      logger4.throwError("use a static from method", Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "new Fragment()"
      });
    }
    populate(this, params);
    this._isFragment = true;
    Object.freeze(this);
  }
  static from(value) {
    if (_Fragment.isFragment(value)) {
      return value;
    }
    if (typeof value === "string") {
      return _Fragment.fromString(value);
    }
    return _Fragment.fromObject(value);
  }
  static fromObject(value) {
    if (_Fragment.isFragment(value)) {
      return value;
    }
    switch (value.type) {
      case "function":
        return FunctionFragment.fromObject(value);
      case "event":
        return EventFragment.fromObject(value);
      case "constructor":
        return ConstructorFragment.fromObject(value);
      case "error":
        return ErrorFragment.fromObject(value);
      case "fallback":
      case "receive":
        return null;
    }
    return logger4.throwArgumentError("invalid fragment object", "value", value);
  }
  static fromString(value) {
    value = value.replace(/\s/g, " ");
    value = value.replace(/\(/g, " (").replace(/\)/g, ") ").replace(/\s+/g, " ");
    value = value.trim();
    if (value.split(" ")[0] === "event") {
      return EventFragment.fromString(value.substring(5).trim());
    } else if (value.split(" ")[0] === "function") {
      return FunctionFragment.fromString(value.substring(8).trim());
    } else if (value.split("(")[0].trim() === "constructor") {
      return ConstructorFragment.fromString(value.trim());
    } else if (value.split(" ")[0] === "error") {
      return ErrorFragment.fromString(value.substring(5).trim());
    }
    return logger4.throwArgumentError("unsupported fragment", "value", value);
  }
  static isFragment(value) {
    return !!(value && value._isFragment);
  }
};
var EventFragment = class _EventFragment extends Fragment {
  format(format) {
    if (!format) {
      format = FormatTypes.sighash;
    }
    if (!FormatTypes[format]) {
      logger4.throwArgumentError("invalid format type", "format", format);
    }
    if (format === FormatTypes.json) {
      return JSON.stringify({
        type: "event",
        anonymous: this.anonymous,
        name: this.name,
        inputs: this.inputs.map((input) => JSON.parse(input.format(format)))
      });
    }
    let result = "";
    if (format !== FormatTypes.sighash) {
      result += "event ";
    }
    result += this.name + "(" + this.inputs.map((input) => input.format(format)).join(format === FormatTypes.full ? ", " : ",") + ") ";
    if (format !== FormatTypes.sighash) {
      if (this.anonymous) {
        result += "anonymous ";
      }
    }
    return result.trim();
  }
  static from(value) {
    if (typeof value === "string") {
      return _EventFragment.fromString(value);
    }
    return _EventFragment.fromObject(value);
  }
  static fromObject(value) {
    if (_EventFragment.isEventFragment(value)) {
      return value;
    }
    if (value.type !== "event") {
      logger4.throwArgumentError("invalid event object", "value", value);
    }
    const params = {
      name: verifyIdentifier(value.name),
      anonymous: value.anonymous,
      inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : [],
      type: "event"
    };
    return new _EventFragment(_constructorGuard2, params);
  }
  static fromString(value) {
    let match = value.match(regexParen);
    if (!match) {
      logger4.throwArgumentError("invalid event string", "value", value);
    }
    let anonymous = false;
    match[3].split(" ").forEach((modifier) => {
      switch (modifier.trim()) {
        case "anonymous":
          anonymous = true;
          break;
        case "":
          break;
        default:
          logger4.warn("unknown modifier: " + modifier);
      }
    });
    return _EventFragment.fromObject({
      name: match[1].trim(),
      anonymous,
      inputs: parseParams(match[2], true),
      type: "event"
    });
  }
  static isEventFragment(value) {
    return value && value._isFragment && value.type === "event";
  }
};
function parseGas(value, params) {
  params.gas = null;
  let comps = value.split("@");
  if (comps.length !== 1) {
    if (comps.length > 2) {
      logger4.throwArgumentError("invalid human-readable ABI signature", "value", value);
    }
    if (!comps[1].match(/^[0-9]+$/)) {
      logger4.throwArgumentError("invalid human-readable ABI signature gas", "value", value);
    }
    params.gas = BigNumber.from(comps[1]);
    return comps[0];
  }
  return value;
}
function parseModifiers(value, params) {
  params.constant = false;
  params.payable = false;
  params.stateMutability = "nonpayable";
  value.split(" ").forEach((modifier) => {
    switch (modifier.trim()) {
      case "constant":
        params.constant = true;
        break;
      case "payable":
        params.payable = true;
        params.stateMutability = "payable";
        break;
      case "nonpayable":
        params.payable = false;
        params.stateMutability = "nonpayable";
        break;
      case "pure":
        params.constant = true;
        params.stateMutability = "pure";
        break;
      case "view":
        params.constant = true;
        params.stateMutability = "view";
        break;
      case "external":
      case "public":
      case "":
        break;
      default:
        console.log("unknown modifier: " + modifier);
    }
  });
}
function verifyState(value) {
  let result = {
    constant: false,
    payable: true,
    stateMutability: "payable"
  };
  if (value.stateMutability != null) {
    result.stateMutability = value.stateMutability;
    result.constant = result.stateMutability === "view" || result.stateMutability === "pure";
    if (value.constant != null) {
      if (!!value.constant !== result.constant) {
        logger4.throwArgumentError("cannot have constant function with mutability " + result.stateMutability, "value", value);
      }
    }
    result.payable = result.stateMutability === "payable";
    if (value.payable != null) {
      if (!!value.payable !== result.payable) {
        logger4.throwArgumentError("cannot have payable function with mutability " + result.stateMutability, "value", value);
      }
    }
  } else if (value.payable != null) {
    result.payable = !!value.payable;
    if (value.constant == null && !result.payable && value.type !== "constructor") {
      logger4.throwArgumentError("unable to determine stateMutability", "value", value);
    }
    result.constant = !!value.constant;
    if (result.constant) {
      result.stateMutability = "view";
    } else {
      result.stateMutability = result.payable ? "payable" : "nonpayable";
    }
    if (result.payable && result.constant) {
      logger4.throwArgumentError("cannot have constant payable function", "value", value);
    }
  } else if (value.constant != null) {
    result.constant = !!value.constant;
    result.payable = !result.constant;
    result.stateMutability = result.constant ? "view" : "payable";
  } else if (value.type !== "constructor") {
    logger4.throwArgumentError("unable to determine stateMutability", "value", value);
  }
  return result;
}
var ConstructorFragment = class _ConstructorFragment extends Fragment {
  format(format) {
    if (!format) {
      format = FormatTypes.sighash;
    }
    if (!FormatTypes[format]) {
      logger4.throwArgumentError("invalid format type", "format", format);
    }
    if (format === FormatTypes.json) {
      return JSON.stringify({
        type: "constructor",
        stateMutability: this.stateMutability !== "nonpayable" ? this.stateMutability : void 0,
        payable: this.payable,
        gas: this.gas ? this.gas.toNumber() : void 0,
        inputs: this.inputs.map((input) => JSON.parse(input.format(format)))
      });
    }
    if (format === FormatTypes.sighash) {
      logger4.throwError("cannot format a constructor for sighash", Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "format(sighash)"
      });
    }
    let result = "constructor(" + this.inputs.map((input) => input.format(format)).join(format === FormatTypes.full ? ", " : ",") + ") ";
    if (this.stateMutability && this.stateMutability !== "nonpayable") {
      result += this.stateMutability + " ";
    }
    return result.trim();
  }
  static from(value) {
    if (typeof value === "string") {
      return _ConstructorFragment.fromString(value);
    }
    return _ConstructorFragment.fromObject(value);
  }
  static fromObject(value) {
    if (_ConstructorFragment.isConstructorFragment(value)) {
      return value;
    }
    if (value.type !== "constructor") {
      logger4.throwArgumentError("invalid constructor object", "value", value);
    }
    let state = verifyState(value);
    if (state.constant) {
      logger4.throwArgumentError("constructor cannot be constant", "value", value);
    }
    const params = {
      name: null,
      type: value.type,
      inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : [],
      payable: state.payable,
      stateMutability: state.stateMutability,
      gas: value.gas ? BigNumber.from(value.gas) : null
    };
    return new _ConstructorFragment(_constructorGuard2, params);
  }
  static fromString(value) {
    let params = { type: "constructor" };
    value = parseGas(value, params);
    let parens = value.match(regexParen);
    if (!parens || parens[1].trim() !== "constructor") {
      logger4.throwArgumentError("invalid constructor string", "value", value);
    }
    params.inputs = parseParams(parens[2].trim(), false);
    parseModifiers(parens[3].trim(), params);
    return _ConstructorFragment.fromObject(params);
  }
  static isConstructorFragment(value) {
    return value && value._isFragment && value.type === "constructor";
  }
};
var FunctionFragment = class _FunctionFragment extends ConstructorFragment {
  format(format) {
    if (!format) {
      format = FormatTypes.sighash;
    }
    if (!FormatTypes[format]) {
      logger4.throwArgumentError("invalid format type", "format", format);
    }
    if (format === FormatTypes.json) {
      return JSON.stringify({
        type: "function",
        name: this.name,
        constant: this.constant,
        stateMutability: this.stateMutability !== "nonpayable" ? this.stateMutability : void 0,
        payable: this.payable,
        gas: this.gas ? this.gas.toNumber() : void 0,
        inputs: this.inputs.map((input) => JSON.parse(input.format(format))),
        outputs: this.outputs.map((output) => JSON.parse(output.format(format)))
      });
    }
    let result = "";
    if (format !== FormatTypes.sighash) {
      result += "function ";
    }
    result += this.name + "(" + this.inputs.map((input) => input.format(format)).join(format === FormatTypes.full ? ", " : ",") + ") ";
    if (format !== FormatTypes.sighash) {
      if (this.stateMutability) {
        if (this.stateMutability !== "nonpayable") {
          result += this.stateMutability + " ";
        }
      } else if (this.constant) {
        result += "view ";
      }
      if (this.outputs && this.outputs.length) {
        result += "returns (" + this.outputs.map((output) => output.format(format)).join(", ") + ") ";
      }
      if (this.gas != null) {
        result += "@" + this.gas.toString() + " ";
      }
    }
    return result.trim();
  }
  static from(value) {
    if (typeof value === "string") {
      return _FunctionFragment.fromString(value);
    }
    return _FunctionFragment.fromObject(value);
  }
  static fromObject(value) {
    if (_FunctionFragment.isFunctionFragment(value)) {
      return value;
    }
    if (value.type !== "function") {
      logger4.throwArgumentError("invalid function object", "value", value);
    }
    let state = verifyState(value);
    const params = {
      type: value.type,
      name: verifyIdentifier(value.name),
      constant: state.constant,
      inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : [],
      outputs: value.outputs ? value.outputs.map(ParamType.fromObject) : [],
      payable: state.payable,
      stateMutability: state.stateMutability,
      gas: value.gas ? BigNumber.from(value.gas) : null
    };
    return new _FunctionFragment(_constructorGuard2, params);
  }
  static fromString(value) {
    let params = { type: "function" };
    value = parseGas(value, params);
    let comps = value.split(" returns ");
    if (comps.length > 2) {
      logger4.throwArgumentError("invalid function string", "value", value);
    }
    let parens = comps[0].match(regexParen);
    if (!parens) {
      logger4.throwArgumentError("invalid function signature", "value", value);
    }
    params.name = parens[1].trim();
    if (params.name) {
      verifyIdentifier(params.name);
    }
    params.inputs = parseParams(parens[2], false);
    parseModifiers(parens[3].trim(), params);
    if (comps.length > 1) {
      let returns = comps[1].match(regexParen);
      if (returns[1].trim() != "" || returns[3].trim() != "") {
        logger4.throwArgumentError("unexpected tokens", "value", value);
      }
      params.outputs = parseParams(returns[2], false);
    } else {
      params.outputs = [];
    }
    return _FunctionFragment.fromObject(params);
  }
  static isFunctionFragment(value) {
    return value && value._isFragment && value.type === "function";
  }
};
function checkForbidden(fragment) {
  const sig = fragment.format();
  if (sig === "Error(string)" || sig === "Panic(uint256)") {
    logger4.throwArgumentError(`cannot specify user defined ${sig} error`, "fragment", fragment);
  }
  return fragment;
}
var ErrorFragment = class _ErrorFragment extends Fragment {
  format(format) {
    if (!format) {
      format = FormatTypes.sighash;
    }
    if (!FormatTypes[format]) {
      logger4.throwArgumentError("invalid format type", "format", format);
    }
    if (format === FormatTypes.json) {
      return JSON.stringify({
        type: "error",
        name: this.name,
        inputs: this.inputs.map((input) => JSON.parse(input.format(format)))
      });
    }
    let result = "";
    if (format !== FormatTypes.sighash) {
      result += "error ";
    }
    result += this.name + "(" + this.inputs.map((input) => input.format(format)).join(format === FormatTypes.full ? ", " : ",") + ") ";
    return result.trim();
  }
  static from(value) {
    if (typeof value === "string") {
      return _ErrorFragment.fromString(value);
    }
    return _ErrorFragment.fromObject(value);
  }
  static fromObject(value) {
    if (_ErrorFragment.isErrorFragment(value)) {
      return value;
    }
    if (value.type !== "error") {
      logger4.throwArgumentError("invalid error object", "value", value);
    }
    const params = {
      type: value.type,
      name: verifyIdentifier(value.name),
      inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : []
    };
    return checkForbidden(new _ErrorFragment(_constructorGuard2, params));
  }
  static fromString(value) {
    let params = { type: "error" };
    let parens = value.match(regexParen);
    if (!parens) {
      logger4.throwArgumentError("invalid error signature", "value", value);
    }
    params.name = parens[1].trim();
    if (params.name) {
      verifyIdentifier(params.name);
    }
    params.inputs = parseParams(parens[2], false);
    return checkForbidden(_ErrorFragment.fromObject(params));
  }
  static isErrorFragment(value) {
    return value && value._isFragment && value.type === "error";
  }
};
function verifyType(type) {
  if (type.match(/^uint($|[^1-9])/)) {
    type = "uint256" + type.substring(4);
  } else if (type.match(/^int($|[^1-9])/)) {
    type = "int256" + type.substring(3);
  }
  return type;
}
var regexIdentifier = new RegExp("^[a-zA-Z$_][a-zA-Z0-9$_]*$");
function verifyIdentifier(value) {
  if (!value || !value.match(regexIdentifier)) {
    logger4.throwArgumentError(`invalid identifier "${value}"`, "value", value);
  }
  return value;
}
var regexParen = new RegExp("^([^)(]*)\\((.*)\\)([^)(]*)$");
function splitNesting(value) {
  value = value.trim();
  let result = [];
  let accum = "";
  let depth = 0;
  for (let offset = 0; offset < value.length; offset++) {
    let c = value[offset];
    if (c === "," && depth === 0) {
      result.push(accum);
      accum = "";
    } else {
      accum += c;
      if (c === "(") {
        depth++;
      } else if (c === ")") {
        depth--;
        if (depth === -1) {
          logger4.throwArgumentError("unbalanced parenthesis", "value", value);
        }
      }
    }
  }
  if (accum) {
    result.push(accum);
  }
  return result;
}

// ../../node_modules/@ethersproject/abi/lib.esm/coders/abstract-coder.js
var logger5 = new Logger(version5);
var Coder = class {
  constructor(name, type, localName, dynamic) {
    this.name = name;
    this.type = type;
    this.localName = localName;
    this.dynamic = dynamic;
  }
  _throwError(message, value) {
    logger5.throwArgumentError(message, this.localName, value);
  }
};
var Writer = class {
  constructor(wordSize) {
    defineReadOnly(this, "wordSize", wordSize || 32);
    this._data = [];
    this._dataLength = 0;
    this._padding = new Uint8Array(wordSize);
  }
  get data() {
    return hexConcat(this._data);
  }
  get length() {
    return this._dataLength;
  }
  _writeData(data) {
    this._data.push(data);
    this._dataLength += data.length;
    return data.length;
  }
  appendWriter(writer) {
    return this._writeData(concat(writer._data));
  }
  // Arrayish items; padded on the right to wordSize
  writeBytes(value) {
    let bytes = arrayify(value);
    const paddingOffset = bytes.length % this.wordSize;
    if (paddingOffset) {
      bytes = concat([bytes, this._padding.slice(paddingOffset)]);
    }
    return this._writeData(bytes);
  }
  _getValue(value) {
    let bytes = arrayify(BigNumber.from(value));
    if (bytes.length > this.wordSize) {
      logger5.throwError("value out-of-bounds", Logger.errors.BUFFER_OVERRUN, {
        length: this.wordSize,
        offset: bytes.length
      });
    }
    if (bytes.length % this.wordSize) {
      bytes = concat([this._padding.slice(bytes.length % this.wordSize), bytes]);
    }
    return bytes;
  }
  // BigNumberish items; padded on the left to wordSize
  writeValue(value) {
    return this._writeData(this._getValue(value));
  }
  writeUpdatableValue() {
    const offset = this._data.length;
    this._data.push(this._padding);
    this._dataLength += this.wordSize;
    return (value) => {
      this._data[offset] = this._getValue(value);
    };
  }
};
var Reader = class _Reader {
  constructor(data, wordSize, coerceFunc, allowLoose) {
    defineReadOnly(this, "_data", arrayify(data));
    defineReadOnly(this, "wordSize", wordSize || 32);
    defineReadOnly(this, "_coerceFunc", coerceFunc);
    defineReadOnly(this, "allowLoose", allowLoose);
    this._offset = 0;
  }
  get data() {
    return hexlify(this._data);
  }
  get consumed() {
    return this._offset;
  }
  // The default Coerce function
  static coerce(name, value) {
    let match = name.match("^u?int([0-9]+)$");
    if (match && parseInt(match[1]) <= 48) {
      value = value.toNumber();
    }
    return value;
  }
  coerce(name, value) {
    if (this._coerceFunc) {
      return this._coerceFunc(name, value);
    }
    return _Reader.coerce(name, value);
  }
  _peekBytes(offset, length, loose) {
    let alignedLength = Math.ceil(length / this.wordSize) * this.wordSize;
    if (this._offset + alignedLength > this._data.length) {
      if (this.allowLoose && loose && this._offset + length <= this._data.length) {
        alignedLength = length;
      } else {
        logger5.throwError("data out-of-bounds", Logger.errors.BUFFER_OVERRUN, {
          length: this._data.length,
          offset: this._offset + alignedLength
        });
      }
    }
    return this._data.slice(this._offset, this._offset + alignedLength);
  }
  subReader(offset) {
    return new _Reader(this._data.slice(this._offset + offset), this.wordSize, this._coerceFunc, this.allowLoose);
  }
  readBytes(length, loose) {
    let bytes = this._peekBytes(0, length, !!loose);
    this._offset += bytes.length;
    return bytes.slice(0, length);
  }
  readValue() {
    return BigNumber.from(this.readBytes(this.wordSize));
  }
};

// ../../node_modules/@ethersproject/keccak256/lib.esm/index.js
var import_js_sha3 = __toESM(require_sha3());
function keccak2562(data) {
  return "0x" + import_js_sha3.default.keccak_256(arrayify(data));
}

// ../../node_modules/@ethersproject/address/lib.esm/_version.js
var version6 = "address/5.7.0";

// ../../node_modules/@ethersproject/address/lib.esm/index.js
var logger6 = new Logger(version6);
function getChecksumAddress(address) {
  if (!isHexString(address, 20)) {
    logger6.throwArgumentError("invalid address", "address", address);
  }
  address = address.toLowerCase();
  const chars = address.substring(2).split("");
  const expanded = new Uint8Array(40);
  for (let i = 0; i < 40; i++) {
    expanded[i] = chars[i].charCodeAt(0);
  }
  const hashed = arrayify(keccak2562(expanded));
  for (let i = 0; i < 40; i += 2) {
    if (hashed[i >> 1] >> 4 >= 8) {
      chars[i] = chars[i].toUpperCase();
    }
    if ((hashed[i >> 1] & 15) >= 8) {
      chars[i + 1] = chars[i + 1].toUpperCase();
    }
  }
  return "0x" + chars.join("");
}
var MAX_SAFE_INTEGER = 9007199254740991;
function log10(x) {
  if (Math.log10) {
    return Math.log10(x);
  }
  return Math.log(x) / Math.LN10;
}
var ibanLookup = {};
for (let i = 0; i < 10; i++) {
  ibanLookup[String(i)] = String(i);
}
for (let i = 0; i < 26; i++) {
  ibanLookup[String.fromCharCode(65 + i)] = String(10 + i);
}
var safeDigits = Math.floor(log10(MAX_SAFE_INTEGER));
function ibanChecksum(address) {
  address = address.toUpperCase();
  address = address.substring(4) + address.substring(0, 2) + "00";
  let expanded = address.split("").map((c) => {
    return ibanLookup[c];
  }).join("");
  while (expanded.length >= safeDigits) {
    let block = expanded.substring(0, safeDigits);
    expanded = parseInt(block, 10) % 97 + expanded.substring(block.length);
  }
  let checksum = String(98 - parseInt(expanded, 10) % 97);
  while (checksum.length < 2) {
    checksum = "0" + checksum;
  }
  return checksum;
}
function getAddress2(address) {
  let result = null;
  if (typeof address !== "string") {
    logger6.throwArgumentError("invalid address", "address", address);
  }
  if (address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {
    if (address.substring(0, 2) !== "0x") {
      address = "0x" + address;
    }
    result = getChecksumAddress(address);
    if (address.match(/([A-F].*[a-f])|([a-f].*[A-F])/) && result !== address) {
      logger6.throwArgumentError("bad address checksum", "address", address);
    }
  } else if (address.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {
    if (address.substring(2, 4) !== ibanChecksum(address)) {
      logger6.throwArgumentError("bad icap checksum", "address", address);
    }
    result = _base36To16(address.substring(4));
    while (result.length < 40) {
      result = "0" + result;
    }
    result = getChecksumAddress("0x" + result);
  } else {
    logger6.throwArgumentError("invalid address", "address", address);
  }
  return result;
}
function getCreate2Address(from, salt, initCodeHash) {
  if (hexDataLength(salt) !== 32) {
    logger6.throwArgumentError("salt must be 32 bytes", "salt", salt);
  }
  if (hexDataLength(initCodeHash) !== 32) {
    logger6.throwArgumentError("initCodeHash must be 32 bytes", "initCodeHash", initCodeHash);
  }
  return getAddress2(hexDataSlice(keccak2562(concat(["0xff", getAddress2(from), salt, initCodeHash])), 12));
}

// ../../node_modules/@ethersproject/abi/lib.esm/coders/address.js
var AddressCoder = class extends Coder {
  constructor(localName) {
    super("address", "address", localName, false);
  }
  defaultValue() {
    return "0x0000000000000000000000000000000000000000";
  }
  encode(writer, value) {
    try {
      value = getAddress2(value);
    } catch (error) {
      this._throwError(error.message, value);
    }
    return writer.writeValue(value);
  }
  decode(reader) {
    return getAddress2(hexZeroPad(reader.readValue().toHexString(), 20));
  }
};

// ../../node_modules/@ethersproject/abi/lib.esm/coders/anonymous.js
var AnonymousCoder = class extends Coder {
  constructor(coder) {
    super(coder.name, coder.type, void 0, coder.dynamic);
    this.coder = coder;
  }
  defaultValue() {
    return this.coder.defaultValue();
  }
  encode(writer, value) {
    return this.coder.encode(writer, value);
  }
  decode(reader) {
    return this.coder.decode(reader);
  }
};

// ../../node_modules/@ethersproject/abi/lib.esm/coders/array.js
var logger7 = new Logger(version5);
function pack(writer, coders, values) {
  let arrayValues = null;
  if (Array.isArray(values)) {
    arrayValues = values;
  } else if (values && typeof values === "object") {
    let unique = {};
    arrayValues = coders.map((coder) => {
      const name = coder.localName;
      if (!name) {
        logger7.throwError("cannot encode object for signature with missing names", Logger.errors.INVALID_ARGUMENT, {
          argument: "values",
          coder,
          value: values
        });
      }
      if (unique[name]) {
        logger7.throwError("cannot encode object for signature with duplicate names", Logger.errors.INVALID_ARGUMENT, {
          argument: "values",
          coder,
          value: values
        });
      }
      unique[name] = true;
      return values[name];
    });
  } else {
    logger7.throwArgumentError("invalid tuple value", "tuple", values);
  }
  if (coders.length !== arrayValues.length) {
    logger7.throwArgumentError("types/value length mismatch", "tuple", values);
  }
  let staticWriter = new Writer(writer.wordSize);
  let dynamicWriter = new Writer(writer.wordSize);
  let updateFuncs = [];
  coders.forEach((coder, index) => {
    let value = arrayValues[index];
    if (coder.dynamic) {
      let dynamicOffset = dynamicWriter.length;
      coder.encode(dynamicWriter, value);
      let updateFunc = staticWriter.writeUpdatableValue();
      updateFuncs.push((baseOffset) => {
        updateFunc(baseOffset + dynamicOffset);
      });
    } else {
      coder.encode(staticWriter, value);
    }
  });
  updateFuncs.forEach((func) => {
    func(staticWriter.length);
  });
  let length = writer.appendWriter(staticWriter);
  length += writer.appendWriter(dynamicWriter);
  return length;
}
function unpack(reader, coders) {
  let values = [];
  let baseReader = reader.subReader(0);
  coders.forEach((coder) => {
    let value = null;
    if (coder.dynamic) {
      let offset = reader.readValue();
      let offsetReader = baseReader.subReader(offset.toNumber());
      try {
        value = coder.decode(offsetReader);
      } catch (error) {
        if (error.code === Logger.errors.BUFFER_OVERRUN) {
          throw error;
        }
        value = error;
        value.baseType = coder.name;
        value.name = coder.localName;
        value.type = coder.type;
      }
    } else {
      try {
        value = coder.decode(reader);
      } catch (error) {
        if (error.code === Logger.errors.BUFFER_OVERRUN) {
          throw error;
        }
        value = error;
        value.baseType = coder.name;
        value.name = coder.localName;
        value.type = coder.type;
      }
    }
    if (value != void 0) {
      values.push(value);
    }
  });
  const uniqueNames = coders.reduce((accum, coder) => {
    const name = coder.localName;
    if (name) {
      if (!accum[name]) {
        accum[name] = 0;
      }
      accum[name]++;
    }
    return accum;
  }, {});
  coders.forEach((coder, index) => {
    let name = coder.localName;
    if (!name || uniqueNames[name] !== 1) {
      return;
    }
    if (name === "length") {
      name = "_length";
    }
    if (values[name] != null) {
      return;
    }
    const value = values[index];
    if (value instanceof Error) {
      Object.defineProperty(values, name, {
        enumerable: true,
        get: () => {
          throw value;
        }
      });
    } else {
      values[name] = value;
    }
  });
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value instanceof Error) {
      Object.defineProperty(values, i, {
        enumerable: true,
        get: () => {
          throw value;
        }
      });
    }
  }
  return Object.freeze(values);
}
var ArrayCoder = class extends Coder {
  constructor(coder, length, localName) {
    const type = coder.type + "[" + (length >= 0 ? length : "") + "]";
    const dynamic = length === -1 || coder.dynamic;
    super("array", type, localName, dynamic);
    this.coder = coder;
    this.length = length;
  }
  defaultValue() {
    const defaultChild = this.coder.defaultValue();
    const result = [];
    for (let i = 0; i < this.length; i++) {
      result.push(defaultChild);
    }
    return result;
  }
  encode(writer, value) {
    if (!Array.isArray(value)) {
      this._throwError("expected array value", value);
    }
    let count = this.length;
    if (count === -1) {
      count = value.length;
      writer.writeValue(value.length);
    }
    logger7.checkArgumentCount(value.length, count, "coder array" + (this.localName ? " " + this.localName : ""));
    let coders = [];
    for (let i = 0; i < value.length; i++) {
      coders.push(this.coder);
    }
    return pack(writer, coders, value);
  }
  decode(reader) {
    let count = this.length;
    if (count === -1) {
      count = reader.readValue().toNumber();
      if (count * 32 > reader._data.length) {
        logger7.throwError("insufficient data length", Logger.errors.BUFFER_OVERRUN, {
          length: reader._data.length,
          count
        });
      }
    }
    let coders = [];
    for (let i = 0; i < count; i++) {
      coders.push(new AnonymousCoder(this.coder));
    }
    return reader.coerce(this.name, unpack(reader, coders));
  }
};

// ../../node_modules/@ethersproject/abi/lib.esm/coders/boolean.js
var BooleanCoder = class extends Coder {
  constructor(localName) {
    super("bool", "bool", localName, false);
  }
  defaultValue() {
    return false;
  }
  encode(writer, value) {
    return writer.writeValue(value ? 1 : 0);
  }
  decode(reader) {
    return reader.coerce(this.type, !reader.readValue().isZero());
  }
};

// ../../node_modules/@ethersproject/abi/lib.esm/coders/bytes.js
var DynamicBytesCoder = class extends Coder {
  constructor(type, localName) {
    super(type, type, localName, true);
  }
  defaultValue() {
    return "0x";
  }
  encode(writer, value) {
    value = arrayify(value);
    let length = writer.writeValue(value.length);
    length += writer.writeBytes(value);
    return length;
  }
  decode(reader) {
    return reader.readBytes(reader.readValue().toNumber(), true);
  }
};
var BytesCoder = class extends DynamicBytesCoder {
  constructor(localName) {
    super("bytes", localName);
  }
  decode(reader) {
    return reader.coerce(this.name, hexlify(super.decode(reader)));
  }
};

// ../../node_modules/@ethersproject/abi/lib.esm/coders/fixed-bytes.js
var FixedBytesCoder = class extends Coder {
  constructor(size, localName) {
    let name = "bytes" + String(size);
    super(name, name, localName, false);
    this.size = size;
  }
  defaultValue() {
    return "0x0000000000000000000000000000000000000000000000000000000000000000".substring(0, 2 + this.size * 2);
  }
  encode(writer, value) {
    let data = arrayify(value);
    if (data.length !== this.size) {
      this._throwError("incorrect data length", value);
    }
    return writer.writeBytes(data);
  }
  decode(reader) {
    return reader.coerce(this.name, hexlify(reader.readBytes(this.size)));
  }
};

// ../../node_modules/@ethersproject/abi/lib.esm/coders/null.js
var NullCoder = class extends Coder {
  constructor(localName) {
    super("null", "", localName, false);
  }
  defaultValue() {
    return null;
  }
  encode(writer, value) {
    if (value != null) {
      this._throwError("not null", value);
    }
    return writer.writeBytes([]);
  }
  decode(reader) {
    reader.readBytes(0);
    return reader.coerce(this.name, null);
  }
};

// ../../node_modules/@ethersproject/constants/lib.esm/bignumbers.js
var NegativeOne = /* @__PURE__ */ BigNumber.from(-1);
var Zero = /* @__PURE__ */ BigNumber.from(0);
var One = /* @__PURE__ */ BigNumber.from(1);
var MaxUint256 = /* @__PURE__ */ BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

// ../../node_modules/@ethersproject/abi/lib.esm/coders/number.js
var NumberCoder = class extends Coder {
  constructor(size, signed, localName) {
    const name = (signed ? "int" : "uint") + size * 8;
    super(name, name, localName, false);
    this.size = size;
    this.signed = signed;
  }
  defaultValue() {
    return 0;
  }
  encode(writer, value) {
    let v = BigNumber.from(value);
    let maxUintValue = MaxUint256.mask(writer.wordSize * 8);
    if (this.signed) {
      let bounds = maxUintValue.mask(this.size * 8 - 1);
      if (v.gt(bounds) || v.lt(bounds.add(One).mul(NegativeOne))) {
        this._throwError("value out-of-bounds", value);
      }
    } else if (v.lt(Zero) || v.gt(maxUintValue.mask(this.size * 8))) {
      this._throwError("value out-of-bounds", value);
    }
    v = v.toTwos(this.size * 8).mask(this.size * 8);
    if (this.signed) {
      v = v.fromTwos(this.size * 8).toTwos(8 * writer.wordSize);
    }
    return writer.writeValue(v);
  }
  decode(reader) {
    let value = reader.readValue().mask(this.size * 8);
    if (this.signed) {
      value = value.fromTwos(this.size * 8);
    }
    return reader.coerce(this.name, value);
  }
};

// ../../node_modules/@ethersproject/strings/lib.esm/_version.js
var version7 = "strings/5.7.0";

// ../../node_modules/@ethersproject/strings/lib.esm/utf8.js
var logger8 = new Logger(version7);
var UnicodeNormalizationForm;
(function(UnicodeNormalizationForm2) {
  UnicodeNormalizationForm2["current"] = "";
  UnicodeNormalizationForm2["NFC"] = "NFC";
  UnicodeNormalizationForm2["NFD"] = "NFD";
  UnicodeNormalizationForm2["NFKC"] = "NFKC";
  UnicodeNormalizationForm2["NFKD"] = "NFKD";
})(UnicodeNormalizationForm || (UnicodeNormalizationForm = {}));
var Utf8ErrorReason;
(function(Utf8ErrorReason2) {
  Utf8ErrorReason2["UNEXPECTED_CONTINUE"] = "unexpected continuation byte";
  Utf8ErrorReason2["BAD_PREFIX"] = "bad codepoint prefix";
  Utf8ErrorReason2["OVERRUN"] = "string overrun";
  Utf8ErrorReason2["MISSING_CONTINUE"] = "missing continuation byte";
  Utf8ErrorReason2["OUT_OF_RANGE"] = "out of UTF-8 range";
  Utf8ErrorReason2["UTF16_SURROGATE"] = "UTF-16 surrogate";
  Utf8ErrorReason2["OVERLONG"] = "overlong representation";
})(Utf8ErrorReason || (Utf8ErrorReason = {}));
function errorFunc(reason, offset, bytes, output, badCodepoint) {
  return logger8.throwArgumentError(`invalid codepoint at offset ${offset}; ${reason}`, "bytes", bytes);
}
function ignoreFunc(reason, offset, bytes, output, badCodepoint) {
  if (reason === Utf8ErrorReason.BAD_PREFIX || reason === Utf8ErrorReason.UNEXPECTED_CONTINUE) {
    let i = 0;
    for (let o = offset + 1; o < bytes.length; o++) {
      if (bytes[o] >> 6 !== 2) {
        break;
      }
      i++;
    }
    return i;
  }
  if (reason === Utf8ErrorReason.OVERRUN) {
    return bytes.length - offset - 1;
  }
  return 0;
}
function replaceFunc(reason, offset, bytes, output, badCodepoint) {
  if (reason === Utf8ErrorReason.OVERLONG) {
    output.push(badCodepoint);
    return 0;
  }
  output.push(65533);
  return ignoreFunc(reason, offset, bytes, output, badCodepoint);
}
var Utf8ErrorFuncs = Object.freeze({
  error: errorFunc,
  ignore: ignoreFunc,
  replace: replaceFunc
});
function getUtf8CodePoints(bytes, onError) {
  if (onError == null) {
    onError = Utf8ErrorFuncs.error;
  }
  bytes = arrayify(bytes);
  const result = [];
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++];
    if (c >> 7 === 0) {
      result.push(c);
      continue;
    }
    let extraLength = null;
    let overlongMask = null;
    if ((c & 224) === 192) {
      extraLength = 1;
      overlongMask = 127;
    } else if ((c & 240) === 224) {
      extraLength = 2;
      overlongMask = 2047;
    } else if ((c & 248) === 240) {
      extraLength = 3;
      overlongMask = 65535;
    } else {
      if ((c & 192) === 128) {
        i += onError(Utf8ErrorReason.UNEXPECTED_CONTINUE, i - 1, bytes, result);
      } else {
        i += onError(Utf8ErrorReason.BAD_PREFIX, i - 1, bytes, result);
      }
      continue;
    }
    if (i - 1 + extraLength >= bytes.length) {
      i += onError(Utf8ErrorReason.OVERRUN, i - 1, bytes, result);
      continue;
    }
    let res = c & (1 << 8 - extraLength - 1) - 1;
    for (let j = 0; j < extraLength; j++) {
      let nextChar = bytes[i];
      if ((nextChar & 192) != 128) {
        i += onError(Utf8ErrorReason.MISSING_CONTINUE, i, bytes, result);
        res = null;
        break;
      }
      ;
      res = res << 6 | nextChar & 63;
      i++;
    }
    if (res === null) {
      continue;
    }
    if (res > 1114111) {
      i += onError(Utf8ErrorReason.OUT_OF_RANGE, i - 1 - extraLength, bytes, result, res);
      continue;
    }
    if (res >= 55296 && res <= 57343) {
      i += onError(Utf8ErrorReason.UTF16_SURROGATE, i - 1 - extraLength, bytes, result, res);
      continue;
    }
    if (res <= overlongMask) {
      i += onError(Utf8ErrorReason.OVERLONG, i - 1 - extraLength, bytes, result, res);
      continue;
    }
    result.push(res);
  }
  return result;
}
function toUtf8Bytes(str, form = UnicodeNormalizationForm.current) {
  if (form != UnicodeNormalizationForm.current) {
    logger8.checkNormalize();
    str = str.normalize(form);
  }
  let result = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 128) {
      result.push(c);
    } else if (c < 2048) {
      result.push(c >> 6 | 192);
      result.push(c & 63 | 128);
    } else if ((c & 64512) == 55296) {
      i++;
      const c2 = str.charCodeAt(i);
      if (i >= str.length || (c2 & 64512) !== 56320) {
        throw new Error("invalid utf-8 string");
      }
      const pair = 65536 + ((c & 1023) << 10) + (c2 & 1023);
      result.push(pair >> 18 | 240);
      result.push(pair >> 12 & 63 | 128);
      result.push(pair >> 6 & 63 | 128);
      result.push(pair & 63 | 128);
    } else {
      result.push(c >> 12 | 224);
      result.push(c >> 6 & 63 | 128);
      result.push(c & 63 | 128);
    }
  }
  return arrayify(result);
}
function _toUtf8String(codePoints) {
  return codePoints.map((codePoint) => {
    if (codePoint <= 65535) {
      return String.fromCharCode(codePoint);
    }
    codePoint -= 65536;
    return String.fromCharCode((codePoint >> 10 & 1023) + 55296, (codePoint & 1023) + 56320);
  }).join("");
}
function toUtf8String(bytes, onError) {
  return _toUtf8String(getUtf8CodePoints(bytes, onError));
}

// ../../node_modules/@ethersproject/abi/lib.esm/coders/string.js
var StringCoder = class extends DynamicBytesCoder {
  constructor(localName) {
    super("string", localName);
  }
  defaultValue() {
    return "";
  }
  encode(writer, value) {
    return super.encode(writer, toUtf8Bytes(value));
  }
  decode(reader) {
    return toUtf8String(super.decode(reader));
  }
};

// ../../node_modules/@ethersproject/abi/lib.esm/coders/tuple.js
var TupleCoder = class extends Coder {
  constructor(coders, localName) {
    let dynamic = false;
    const types = [];
    coders.forEach((coder) => {
      if (coder.dynamic) {
        dynamic = true;
      }
      types.push(coder.type);
    });
    const type = "tuple(" + types.join(",") + ")";
    super("tuple", type, localName, dynamic);
    this.coders = coders;
  }
  defaultValue() {
    const values = [];
    this.coders.forEach((coder) => {
      values.push(coder.defaultValue());
    });
    const uniqueNames = this.coders.reduce((accum, coder) => {
      const name = coder.localName;
      if (name) {
        if (!accum[name]) {
          accum[name] = 0;
        }
        accum[name]++;
      }
      return accum;
    }, {});
    this.coders.forEach((coder, index) => {
      let name = coder.localName;
      if (!name || uniqueNames[name] !== 1) {
        return;
      }
      if (name === "length") {
        name = "_length";
      }
      if (values[name] != null) {
        return;
      }
      values[name] = values[index];
    });
    return Object.freeze(values);
  }
  encode(writer, value) {
    return pack(writer, this.coders, value);
  }
  decode(reader) {
    return reader.coerce(this.name, unpack(reader, this.coders));
  }
};

// ../../node_modules/@ethersproject/abi/lib.esm/abi-coder.js
var logger9 = new Logger(version5);
var paramTypeBytes = new RegExp(/^bytes([0-9]*)$/);
var paramTypeNumber = new RegExp(/^(u?int)([0-9]*)$/);
var AbiCoder = class {
  constructor(coerceFunc) {
    defineReadOnly(this, "coerceFunc", coerceFunc || null);
  }
  _getCoder(param) {
    switch (param.baseType) {
      case "address":
        return new AddressCoder(param.name);
      case "bool":
        return new BooleanCoder(param.name);
      case "string":
        return new StringCoder(param.name);
      case "bytes":
        return new BytesCoder(param.name);
      case "array":
        return new ArrayCoder(this._getCoder(param.arrayChildren), param.arrayLength, param.name);
      case "tuple":
        return new TupleCoder((param.components || []).map((component) => {
          return this._getCoder(component);
        }), param.name);
      case "":
        return new NullCoder(param.name);
    }
    let match = param.type.match(paramTypeNumber);
    if (match) {
      let size = parseInt(match[2] || "256");
      if (size === 0 || size > 256 || size % 8 !== 0) {
        logger9.throwArgumentError("invalid " + match[1] + " bit length", "param", param);
      }
      return new NumberCoder(size / 8, match[1] === "int", param.name);
    }
    match = param.type.match(paramTypeBytes);
    if (match) {
      let size = parseInt(match[1]);
      if (size === 0 || size > 32) {
        logger9.throwArgumentError("invalid bytes length", "param", param);
      }
      return new FixedBytesCoder(size, param.name);
    }
    return logger9.throwArgumentError("invalid type", "type", param.type);
  }
  _getWordSize() {
    return 32;
  }
  _getReader(data, allowLoose) {
    return new Reader(data, this._getWordSize(), this.coerceFunc, allowLoose);
  }
  _getWriter() {
    return new Writer(this._getWordSize());
  }
  getDefaultValue(types) {
    const coders = types.map((type) => this._getCoder(ParamType.from(type)));
    const coder = new TupleCoder(coders, "_");
    return coder.defaultValue();
  }
  encode(types, values) {
    if (types.length !== values.length) {
      logger9.throwError("types/values length mismatch", Logger.errors.INVALID_ARGUMENT, {
        count: { types: types.length, values: values.length },
        value: { types, values }
      });
    }
    const coders = types.map((type) => this._getCoder(ParamType.from(type)));
    const coder = new TupleCoder(coders, "_");
    const writer = this._getWriter();
    coder.encode(writer, values);
    return writer.data;
  }
  decode(types, data, loose) {
    const coders = types.map((type) => this._getCoder(ParamType.from(type)));
    const coder = new TupleCoder(coders, "_");
    return coder.decode(this._getReader(arrayify(data), loose));
  }
};
var defaultAbiCoder = new AbiCoder();

// ../../node_modules/@ethersproject/hash/lib.esm/id.js
function id(text) {
  return keccak2562(toUtf8Bytes(text));
}

// ../../node_modules/@ethersproject/abi/lib.esm/interface.js
var logger10 = new Logger(version5);
var LogDescription = class extends Description {
};
var TransactionDescription = class extends Description {
};
var ErrorDescription = class extends Description {
};
var Indexed = class extends Description {
  static isIndexed(value) {
    return !!(value && value._isIndexed);
  }
};
var BuiltinErrors = {
  "0x08c379a0": { signature: "Error(string)", name: "Error", inputs: ["string"], reason: true },
  "0x4e487b71": { signature: "Panic(uint256)", name: "Panic", inputs: ["uint256"] }
};
function wrapAccessError(property, error) {
  const wrap = new Error(`deferred error during ABI decoding triggered accessing ${property}`);
  wrap.error = error;
  return wrap;
}
var Interface = class {
  constructor(fragments) {
    let abi = [];
    if (typeof fragments === "string") {
      abi = JSON.parse(fragments);
    } else {
      abi = fragments;
    }
    defineReadOnly(this, "fragments", abi.map((fragment) => {
      return Fragment.from(fragment);
    }).filter((fragment) => fragment != null));
    defineReadOnly(this, "_abiCoder", getStatic(new.target, "getAbiCoder")());
    defineReadOnly(this, "functions", {});
    defineReadOnly(this, "errors", {});
    defineReadOnly(this, "events", {});
    defineReadOnly(this, "structs", {});
    this.fragments.forEach((fragment) => {
      let bucket = null;
      switch (fragment.type) {
        case "constructor":
          if (this.deploy) {
            logger10.warn("duplicate definition - constructor");
            return;
          }
          defineReadOnly(this, "deploy", fragment);
          return;
        case "function":
          bucket = this.functions;
          break;
        case "event":
          bucket = this.events;
          break;
        case "error":
          bucket = this.errors;
          break;
        default:
          return;
      }
      let signature = fragment.format();
      if (bucket[signature]) {
        logger10.warn("duplicate definition - " + signature);
        return;
      }
      bucket[signature] = fragment;
    });
    if (!this.deploy) {
      defineReadOnly(this, "deploy", ConstructorFragment.from({
        payable: false,
        type: "constructor"
      }));
    }
    defineReadOnly(this, "_isInterface", true);
  }
  format(format) {
    if (!format) {
      format = FormatTypes.full;
    }
    if (format === FormatTypes.sighash) {
      logger10.throwArgumentError("interface does not support formatting sighash", "format", format);
    }
    const abi = this.fragments.map((fragment) => fragment.format(format));
    if (format === FormatTypes.json) {
      return JSON.stringify(abi.map((j) => JSON.parse(j)));
    }
    return abi;
  }
  // Sub-classes can override these to handle other blockchains
  static getAbiCoder() {
    return defaultAbiCoder;
  }
  static getAddress(address) {
    return getAddress2(address);
  }
  static getSighash(fragment) {
    return hexDataSlice(id(fragment.format()), 0, 4);
  }
  static getEventTopic(eventFragment) {
    return id(eventFragment.format());
  }
  // Find a function definition by any means necessary (unless it is ambiguous)
  getFunction(nameOrSignatureOrSighash) {
    if (isHexString(nameOrSignatureOrSighash)) {
      for (const name in this.functions) {
        if (nameOrSignatureOrSighash === this.getSighash(name)) {
          return this.functions[name];
        }
      }
      logger10.throwArgumentError("no matching function", "sighash", nameOrSignatureOrSighash);
    }
    if (nameOrSignatureOrSighash.indexOf("(") === -1) {
      const name = nameOrSignatureOrSighash.trim();
      const matching = Object.keys(this.functions).filter((f) => f.split(
        "("
        /* fix:) */
      )[0] === name);
      if (matching.length === 0) {
        logger10.throwArgumentError("no matching function", "name", name);
      } else if (matching.length > 1) {
        logger10.throwArgumentError("multiple matching functions", "name", name);
      }
      return this.functions[matching[0]];
    }
    const result = this.functions[FunctionFragment.fromString(nameOrSignatureOrSighash).format()];
    if (!result) {
      logger10.throwArgumentError("no matching function", "signature", nameOrSignatureOrSighash);
    }
    return result;
  }
  // Find an event definition by any means necessary (unless it is ambiguous)
  getEvent(nameOrSignatureOrTopic) {
    if (isHexString(nameOrSignatureOrTopic)) {
      const topichash = nameOrSignatureOrTopic.toLowerCase();
      for (const name in this.events) {
        if (topichash === this.getEventTopic(name)) {
          return this.events[name];
        }
      }
      logger10.throwArgumentError("no matching event", "topichash", topichash);
    }
    if (nameOrSignatureOrTopic.indexOf("(") === -1) {
      const name = nameOrSignatureOrTopic.trim();
      const matching = Object.keys(this.events).filter((f) => f.split(
        "("
        /* fix:) */
      )[0] === name);
      if (matching.length === 0) {
        logger10.throwArgumentError("no matching event", "name", name);
      } else if (matching.length > 1) {
        logger10.throwArgumentError("multiple matching events", "name", name);
      }
      return this.events[matching[0]];
    }
    const result = this.events[EventFragment.fromString(nameOrSignatureOrTopic).format()];
    if (!result) {
      logger10.throwArgumentError("no matching event", "signature", nameOrSignatureOrTopic);
    }
    return result;
  }
  // Find a function definition by any means necessary (unless it is ambiguous)
  getError(nameOrSignatureOrSighash) {
    if (isHexString(nameOrSignatureOrSighash)) {
      const getSighash = getStatic(this.constructor, "getSighash");
      for (const name in this.errors) {
        const error = this.errors[name];
        if (nameOrSignatureOrSighash === getSighash(error)) {
          return this.errors[name];
        }
      }
      logger10.throwArgumentError("no matching error", "sighash", nameOrSignatureOrSighash);
    }
    if (nameOrSignatureOrSighash.indexOf("(") === -1) {
      const name = nameOrSignatureOrSighash.trim();
      const matching = Object.keys(this.errors).filter((f) => f.split(
        "("
        /* fix:) */
      )[0] === name);
      if (matching.length === 0) {
        logger10.throwArgumentError("no matching error", "name", name);
      } else if (matching.length > 1) {
        logger10.throwArgumentError("multiple matching errors", "name", name);
      }
      return this.errors[matching[0]];
    }
    const result = this.errors[FunctionFragment.fromString(nameOrSignatureOrSighash).format()];
    if (!result) {
      logger10.throwArgumentError("no matching error", "signature", nameOrSignatureOrSighash);
    }
    return result;
  }
  // Get the sighash (the bytes4 selector) used by Solidity to identify a function
  getSighash(fragment) {
    if (typeof fragment === "string") {
      try {
        fragment = this.getFunction(fragment);
      } catch (error) {
        try {
          fragment = this.getError(fragment);
        } catch (_) {
          throw error;
        }
      }
    }
    return getStatic(this.constructor, "getSighash")(fragment);
  }
  // Get the topic (the bytes32 hash) used by Solidity to identify an event
  getEventTopic(eventFragment) {
    if (typeof eventFragment === "string") {
      eventFragment = this.getEvent(eventFragment);
    }
    return getStatic(this.constructor, "getEventTopic")(eventFragment);
  }
  _decodeParams(params, data) {
    return this._abiCoder.decode(params, data);
  }
  _encodeParams(params, values) {
    return this._abiCoder.encode(params, values);
  }
  encodeDeploy(values) {
    return this._encodeParams(this.deploy.inputs, values || []);
  }
  decodeErrorResult(fragment, data) {
    if (typeof fragment === "string") {
      fragment = this.getError(fragment);
    }
    const bytes = arrayify(data);
    if (hexlify(bytes.slice(0, 4)) !== this.getSighash(fragment)) {
      logger10.throwArgumentError(`data signature does not match error ${fragment.name}.`, "data", hexlify(bytes));
    }
    return this._decodeParams(fragment.inputs, bytes.slice(4));
  }
  encodeErrorResult(fragment, values) {
    if (typeof fragment === "string") {
      fragment = this.getError(fragment);
    }
    return hexlify(concat([
      this.getSighash(fragment),
      this._encodeParams(fragment.inputs, values || [])
    ]));
  }
  // Decode the data for a function call (e.g. tx.data)
  decodeFunctionData(functionFragment, data) {
    if (typeof functionFragment === "string") {
      functionFragment = this.getFunction(functionFragment);
    }
    const bytes = arrayify(data);
    if (hexlify(bytes.slice(0, 4)) !== this.getSighash(functionFragment)) {
      logger10.throwArgumentError(`data signature does not match function ${functionFragment.name}.`, "data", hexlify(bytes));
    }
    return this._decodeParams(functionFragment.inputs, bytes.slice(4));
  }
  // Encode the data for a function call (e.g. tx.data)
  encodeFunctionData(functionFragment, values) {
    if (typeof functionFragment === "string") {
      functionFragment = this.getFunction(functionFragment);
    }
    return hexlify(concat([
      this.getSighash(functionFragment),
      this._encodeParams(functionFragment.inputs, values || [])
    ]));
  }
  // Decode the result from a function call (e.g. from eth_call)
  decodeFunctionResult(functionFragment, data) {
    if (typeof functionFragment === "string") {
      functionFragment = this.getFunction(functionFragment);
    }
    let bytes = arrayify(data);
    let reason = null;
    let message = "";
    let errorArgs = null;
    let errorName = null;
    let errorSignature = null;
    switch (bytes.length % this._abiCoder._getWordSize()) {
      case 0:
        try {
          return this._abiCoder.decode(functionFragment.outputs, bytes);
        } catch (error) {
        }
        break;
      case 4: {
        const selector = hexlify(bytes.slice(0, 4));
        const builtin = BuiltinErrors[selector];
        if (builtin) {
          errorArgs = this._abiCoder.decode(builtin.inputs, bytes.slice(4));
          errorName = builtin.name;
          errorSignature = builtin.signature;
          if (builtin.reason) {
            reason = errorArgs[0];
          }
          if (errorName === "Error") {
            message = `; VM Exception while processing transaction: reverted with reason string ${JSON.stringify(errorArgs[0])}`;
          } else if (errorName === "Panic") {
            message = `; VM Exception while processing transaction: reverted with panic code ${errorArgs[0]}`;
          }
        } else {
          try {
            const error = this.getError(selector);
            errorArgs = this._abiCoder.decode(error.inputs, bytes.slice(4));
            errorName = error.name;
            errorSignature = error.format();
          } catch (error) {
          }
        }
        break;
      }
    }
    return logger10.throwError("call revert exception" + message, Logger.errors.CALL_EXCEPTION, {
      method: functionFragment.format(),
      data: hexlify(data),
      errorArgs,
      errorName,
      errorSignature,
      reason
    });
  }
  // Encode the result for a function call (e.g. for eth_call)
  encodeFunctionResult(functionFragment, values) {
    if (typeof functionFragment === "string") {
      functionFragment = this.getFunction(functionFragment);
    }
    return hexlify(this._abiCoder.encode(functionFragment.outputs, values || []));
  }
  // Create the filter for the event with search criteria (e.g. for eth_filterLog)
  encodeFilterTopics(eventFragment, values) {
    if (typeof eventFragment === "string") {
      eventFragment = this.getEvent(eventFragment);
    }
    if (values.length > eventFragment.inputs.length) {
      logger10.throwError("too many arguments for " + eventFragment.format(), Logger.errors.UNEXPECTED_ARGUMENT, {
        argument: "values",
        value: values
      });
    }
    let topics = [];
    if (!eventFragment.anonymous) {
      topics.push(this.getEventTopic(eventFragment));
    }
    const encodeTopic = (param, value) => {
      if (param.type === "string") {
        return id(value);
      } else if (param.type === "bytes") {
        return keccak2562(hexlify(value));
      }
      if (param.type === "bool" && typeof value === "boolean") {
        value = value ? "0x01" : "0x00";
      }
      if (param.type.match(/^u?int/)) {
        value = BigNumber.from(value).toHexString();
      }
      if (param.type === "address") {
        this._abiCoder.encode(["address"], [value]);
      }
      return hexZeroPad(hexlify(value), 32);
    };
    values.forEach((value, index) => {
      let param = eventFragment.inputs[index];
      if (!param.indexed) {
        if (value != null) {
          logger10.throwArgumentError("cannot filter non-indexed parameters; must be null", "contract." + param.name, value);
        }
        return;
      }
      if (value == null) {
        topics.push(null);
      } else if (param.baseType === "array" || param.baseType === "tuple") {
        logger10.throwArgumentError("filtering with tuples or arrays not supported", "contract." + param.name, value);
      } else if (Array.isArray(value)) {
        topics.push(value.map((value2) => encodeTopic(param, value2)));
      } else {
        topics.push(encodeTopic(param, value));
      }
    });
    while (topics.length && topics[topics.length - 1] === null) {
      topics.pop();
    }
    return topics;
  }
  encodeEventLog(eventFragment, values) {
    if (typeof eventFragment === "string") {
      eventFragment = this.getEvent(eventFragment);
    }
    const topics = [];
    const dataTypes = [];
    const dataValues = [];
    if (!eventFragment.anonymous) {
      topics.push(this.getEventTopic(eventFragment));
    }
    if (values.length !== eventFragment.inputs.length) {
      logger10.throwArgumentError("event arguments/values mismatch", "values", values);
    }
    eventFragment.inputs.forEach((param, index) => {
      const value = values[index];
      if (param.indexed) {
        if (param.type === "string") {
          topics.push(id(value));
        } else if (param.type === "bytes") {
          topics.push(keccak2562(value));
        } else if (param.baseType === "tuple" || param.baseType === "array") {
          throw new Error("not implemented");
        } else {
          topics.push(this._abiCoder.encode([param.type], [value]));
        }
      } else {
        dataTypes.push(param);
        dataValues.push(value);
      }
    });
    return {
      data: this._abiCoder.encode(dataTypes, dataValues),
      topics
    };
  }
  // Decode a filter for the event and the search criteria
  decodeEventLog(eventFragment, data, topics) {
    if (typeof eventFragment === "string") {
      eventFragment = this.getEvent(eventFragment);
    }
    if (topics != null && !eventFragment.anonymous) {
      let topicHash = this.getEventTopic(eventFragment);
      if (!isHexString(topics[0], 32) || topics[0].toLowerCase() !== topicHash) {
        logger10.throwError("fragment/topic mismatch", Logger.errors.INVALID_ARGUMENT, { argument: "topics[0]", expected: topicHash, value: topics[0] });
      }
      topics = topics.slice(1);
    }
    let indexed = [];
    let nonIndexed = [];
    let dynamic = [];
    eventFragment.inputs.forEach((param, index) => {
      if (param.indexed) {
        if (param.type === "string" || param.type === "bytes" || param.baseType === "tuple" || param.baseType === "array") {
          indexed.push(ParamType.fromObject({ type: "bytes32", name: param.name }));
          dynamic.push(true);
        } else {
          indexed.push(param);
          dynamic.push(false);
        }
      } else {
        nonIndexed.push(param);
        dynamic.push(false);
      }
    });
    let resultIndexed = topics != null ? this._abiCoder.decode(indexed, concat(topics)) : null;
    let resultNonIndexed = this._abiCoder.decode(nonIndexed, data, true);
    let result = [];
    let nonIndexedIndex = 0, indexedIndex = 0;
    eventFragment.inputs.forEach((param, index) => {
      if (param.indexed) {
        if (resultIndexed == null) {
          result[index] = new Indexed({ _isIndexed: true, hash: null });
        } else if (dynamic[index]) {
          result[index] = new Indexed({ _isIndexed: true, hash: resultIndexed[indexedIndex++] });
        } else {
          try {
            result[index] = resultIndexed[indexedIndex++];
          } catch (error) {
            result[index] = error;
          }
        }
      } else {
        try {
          result[index] = resultNonIndexed[nonIndexedIndex++];
        } catch (error) {
          result[index] = error;
        }
      }
      if (param.name && result[param.name] == null) {
        const value = result[index];
        if (value instanceof Error) {
          Object.defineProperty(result, param.name, {
            enumerable: true,
            get: () => {
              throw wrapAccessError(`property ${JSON.stringify(param.name)}`, value);
            }
          });
        } else {
          result[param.name] = value;
        }
      }
    });
    for (let i = 0; i < result.length; i++) {
      const value = result[i];
      if (value instanceof Error) {
        Object.defineProperty(result, i, {
          enumerable: true,
          get: () => {
            throw wrapAccessError(`index ${i}`, value);
          }
        });
      }
    }
    return Object.freeze(result);
  }
  // Given a transaction, find the matching function fragment (if any) and
  // determine all its properties and call parameters
  parseTransaction(tx) {
    let fragment = this.getFunction(tx.data.substring(0, 10).toLowerCase());
    if (!fragment) {
      return null;
    }
    return new TransactionDescription({
      args: this._abiCoder.decode(fragment.inputs, "0x" + tx.data.substring(10)),
      functionFragment: fragment,
      name: fragment.name,
      signature: fragment.format(),
      sighash: this.getSighash(fragment),
      value: BigNumber.from(tx.value || "0")
    });
  }
  // @TODO
  //parseCallResult(data: BytesLike): ??
  // Given an event log, find the matching event fragment (if any) and
  // determine all its properties and values
  parseLog(log) {
    let fragment = this.getEvent(log.topics[0]);
    if (!fragment || fragment.anonymous) {
      return null;
    }
    return new LogDescription({
      eventFragment: fragment,
      name: fragment.name,
      signature: fragment.format(),
      topic: this.getEventTopic(fragment),
      args: this.decodeEventLog(fragment, log.data, log.topics)
    });
  }
  parseError(data) {
    const hexData = hexlify(data);
    let fragment = this.getError(hexData.substring(0, 10).toLowerCase());
    if (!fragment) {
      return null;
    }
    return new ErrorDescription({
      args: this._abiCoder.decode(fragment.inputs, "0x" + hexData.substring(10)),
      errorFragment: fragment,
      name: fragment.name,
      signature: fragment.format(),
      sighash: this.getSighash(fragment)
    });
  }
  /*
  static from(value: Array<Fragment | string | JsonAbi> | string | Interface) {
      if (Interface.isInterface(value)) {
          return value;
      }
      if (typeof(value) === "string") {
          return new Interface(JSON.parse(value));
      }
      return new Interface(value);
  }
  */
  static isInterface(value) {
    return !!(value && value._isInterface);
  }
};

// ../../node_modules/@ethersproject/solidity/lib.esm/_version.js
var version8 = "solidity/5.7.0";

// ../../node_modules/@ethersproject/solidity/lib.esm/index.js
var regexBytes = new RegExp("^bytes([0-9]+)$");
var regexNumber = new RegExp("^(u?int)([0-9]*)$");
var regexArray = new RegExp("^(.*)\\[([0-9]*)\\]$");
var Zeros = "0000000000000000000000000000000000000000000000000000000000000000";
var logger11 = new Logger(version8);
function _pack(type, value, isArray) {
  switch (type) {
    case "address":
      if (isArray) {
        return zeroPad(value, 32);
      }
      return arrayify(value);
    case "string":
      return toUtf8Bytes(value);
    case "bytes":
      return arrayify(value);
    case "bool":
      value = value ? "0x01" : "0x00";
      if (isArray) {
        return zeroPad(value, 32);
      }
      return arrayify(value);
  }
  let match = type.match(regexNumber);
  if (match) {
    let size = parseInt(match[2] || "256");
    if (match[2] && String(size) !== match[2] || size % 8 !== 0 || size === 0 || size > 256) {
      logger11.throwArgumentError("invalid number type", "type", type);
    }
    if (isArray) {
      size = 256;
    }
    value = BigNumber.from(value).toTwos(size);
    return zeroPad(value, size / 8);
  }
  match = type.match(regexBytes);
  if (match) {
    const size = parseInt(match[1]);
    if (String(size) !== match[1] || size === 0 || size > 32) {
      logger11.throwArgumentError("invalid bytes type", "type", type);
    }
    if (arrayify(value).byteLength !== size) {
      logger11.throwArgumentError(`invalid value for ${type}`, "value", value);
    }
    if (isArray) {
      return arrayify((value + Zeros).substring(0, 66));
    }
    return value;
  }
  match = type.match(regexArray);
  if (match && Array.isArray(value)) {
    const baseType = match[1];
    const count = parseInt(match[2] || String(value.length));
    if (count != value.length) {
      logger11.throwArgumentError(`invalid array length for ${type}`, "value", value);
    }
    const result = [];
    value.forEach(function(value2) {
      result.push(_pack(baseType, value2, true));
    });
    return concat(result);
  }
  return logger11.throwArgumentError("invalid type", "type", type);
}
function pack2(types, values) {
  if (types.length != values.length) {
    logger11.throwArgumentError("wrong number of values; expected ${ types.length }", "values", values);
  }
  const tight = [];
  types.forEach(function(type, index) {
    tight.push(_pack(type, values[index]));
  });
  return hexlify(concat(tight));
}
function keccak2563(types, values) {
  return keccak2562(pack2(types, values));
}

// ../../node_modules/@uniswap/v3-periphery/artifacts/contracts/interfaces/IMulticall.sol/IMulticall.json
var IMulticall_default = {
  _format: "hh-sol-artifact-1",
  contractName: "IMulticall",
  sourceName: "contracts/interfaces/IMulticall.sol",
  abi: [
    {
      inputs: [
        {
          internalType: "bytes[]",
          name: "data",
          type: "bytes[]"
        }
      ],
      name: "multicall",
      outputs: [
        {
          internalType: "bytes[]",
          name: "results",
          type: "bytes[]"
        }
      ],
      stateMutability: "payable",
      type: "function"
    }
  ],
  bytecode: "0x",
  deployedBytecode: "0x",
  linkReferences: {},
  deployedLinkReferences: {}
};

// ../../node_modules/@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json
var NonfungiblePositionManager_default = {
  _format: "hh-sol-artifact-1",
  contractName: "NonfungiblePositionManager",
  sourceName: "contracts/NonfungiblePositionManager.sol",
  abi: [
    {
      inputs: [
        {
          internalType: "address",
          name: "_factory",
          type: "address"
        },
        {
          internalType: "address",
          name: "_WETH9",
          type: "address"
        },
        {
          internalType: "address",
          name: "_tokenDescriptor_",
          type: "address"
        }
      ],
      stateMutability: "nonpayable",
      type: "constructor"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "approved",
          type: "address"
        },
        {
          indexed: true,
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "Approval",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "operator",
          type: "address"
        },
        {
          indexed: false,
          internalType: "bool",
          name: "approved",
          type: "bool"
        }
      ],
      name: "ApprovalForAll",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "address",
          name: "recipient",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount0",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount1",
          type: "uint256"
        }
      ],
      name: "Collect",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint128",
          name: "liquidity",
          type: "uint128"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount0",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount1",
          type: "uint256"
        }
      ],
      name: "DecreaseLiquidity",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint128",
          name: "liquidity",
          type: "uint128"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount0",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount1",
          type: "uint256"
        }
      ],
      name: "IncreaseLiquidity",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "from",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          indexed: true,
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "Transfer",
      type: "event"
    },
    {
      inputs: [],
      name: "DOMAIN_SEPARATOR",
      outputs: [
        {
          internalType: "bytes32",
          name: "",
          type: "bytes32"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "PERMIT_TYPEHASH",
      outputs: [
        {
          internalType: "bytes32",
          name: "",
          type: "bytes32"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "WETH9",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "approve",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        }
      ],
      name: "balanceOf",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "baseURI",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string"
        }
      ],
      stateMutability: "pure",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "burn",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "uint256",
              name: "tokenId",
              type: "uint256"
            },
            {
              internalType: "address",
              name: "recipient",
              type: "address"
            },
            {
              internalType: "uint128",
              name: "amount0Max",
              type: "uint128"
            },
            {
              internalType: "uint128",
              name: "amount1Max",
              type: "uint128"
            }
          ],
          internalType: "struct INonfungiblePositionManager.CollectParams",
          name: "params",
          type: "tuple"
        }
      ],
      name: "collect",
      outputs: [
        {
          internalType: "uint256",
          name: "amount0",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "amount1",
          type: "uint256"
        }
      ],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token0",
          type: "address"
        },
        {
          internalType: "address",
          name: "token1",
          type: "address"
        },
        {
          internalType: "uint24",
          name: "fee",
          type: "uint24"
        },
        {
          internalType: "uint160",
          name: "sqrtPriceX96",
          type: "uint160"
        }
      ],
      name: "createAndInitializePoolIfNecessary",
      outputs: [
        {
          internalType: "address",
          name: "pool",
          type: "address"
        }
      ],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "uint256",
              name: "tokenId",
              type: "uint256"
            },
            {
              internalType: "uint128",
              name: "liquidity",
              type: "uint128"
            },
            {
              internalType: "uint256",
              name: "amount0Min",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amount1Min",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "deadline",
              type: "uint256"
            }
          ],
          internalType: "struct INonfungiblePositionManager.DecreaseLiquidityParams",
          name: "params",
          type: "tuple"
        }
      ],
      name: "decreaseLiquidity",
      outputs: [
        {
          internalType: "uint256",
          name: "amount0",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "amount1",
          type: "uint256"
        }
      ],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [],
      name: "factory",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "getApproved",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "uint256",
              name: "tokenId",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amount0Desired",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amount1Desired",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amount0Min",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amount1Min",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "deadline",
              type: "uint256"
            }
          ],
          internalType: "struct INonfungiblePositionManager.IncreaseLiquidityParams",
          name: "params",
          type: "tuple"
        }
      ],
      name: "increaseLiquidity",
      outputs: [
        {
          internalType: "uint128",
          name: "liquidity",
          type: "uint128"
        },
        {
          internalType: "uint256",
          name: "amount0",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "amount1",
          type: "uint256"
        }
      ],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          internalType: "address",
          name: "operator",
          type: "address"
        }
      ],
      name: "isApprovedForAll",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "address",
              name: "token0",
              type: "address"
            },
            {
              internalType: "address",
              name: "token1",
              type: "address"
            },
            {
              internalType: "uint24",
              name: "fee",
              type: "uint24"
            },
            {
              internalType: "int24",
              name: "tickLower",
              type: "int24"
            },
            {
              internalType: "int24",
              name: "tickUpper",
              type: "int24"
            },
            {
              internalType: "uint256",
              name: "amount0Desired",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amount1Desired",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amount0Min",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amount1Min",
              type: "uint256"
            },
            {
              internalType: "address",
              name: "recipient",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "deadline",
              type: "uint256"
            }
          ],
          internalType: "struct INonfungiblePositionManager.MintParams",
          name: "params",
          type: "tuple"
        }
      ],
      name: "mint",
      outputs: [
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          internalType: "uint128",
          name: "liquidity",
          type: "uint128"
        },
        {
          internalType: "uint256",
          name: "amount0",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "amount1",
          type: "uint256"
        }
      ],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "bytes[]",
          name: "data",
          type: "bytes[]"
        }
      ],
      name: "multicall",
      outputs: [
        {
          internalType: "bytes[]",
          name: "results",
          type: "bytes[]"
        }
      ],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [],
      name: "name",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "ownerOf",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "spender",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "deadline",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "permit",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "positions",
      outputs: [
        {
          internalType: "uint96",
          name: "nonce",
          type: "uint96"
        },
        {
          internalType: "address",
          name: "operator",
          type: "address"
        },
        {
          internalType: "address",
          name: "token0",
          type: "address"
        },
        {
          internalType: "address",
          name: "token1",
          type: "address"
        },
        {
          internalType: "uint24",
          name: "fee",
          type: "uint24"
        },
        {
          internalType: "int24",
          name: "tickLower",
          type: "int24"
        },
        {
          internalType: "int24",
          name: "tickUpper",
          type: "int24"
        },
        {
          internalType: "uint128",
          name: "liquidity",
          type: "uint128"
        },
        {
          internalType: "uint256",
          name: "feeGrowthInside0LastX128",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "feeGrowthInside1LastX128",
          type: "uint256"
        },
        {
          internalType: "uint128",
          name: "tokensOwed0",
          type: "uint128"
        },
        {
          internalType: "uint128",
          name: "tokensOwed1",
          type: "uint128"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "refundETH",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "from",
          type: "address"
        },
        {
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "safeTransferFrom",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "from",
          type: "address"
        },
        {
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          internalType: "bytes",
          name: "_data",
          type: "bytes"
        }
      ],
      name: "safeTransferFrom",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "deadline",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "selfPermit",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "nonce",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "expiry",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "selfPermitAllowed",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "nonce",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "expiry",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "selfPermitAllowedIfNecessary",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "deadline",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "selfPermitIfNecessary",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "operator",
          type: "address"
        },
        {
          internalType: "bool",
          name: "approved",
          type: "bool"
        }
      ],
      name: "setApprovalForAll",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "bytes4",
          name: "interfaceId",
          type: "bytes4"
        }
      ],
      name: "supportsInterface",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "amountMinimum",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "recipient",
          type: "address"
        }
      ],
      name: "sweepToken",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [],
      name: "symbol",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "index",
          type: "uint256"
        }
      ],
      name: "tokenByIndex",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "index",
          type: "uint256"
        }
      ],
      name: "tokenOfOwnerByIndex",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "tokenURI",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "totalSupply",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "from",
          type: "address"
        },
        {
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "transferFrom",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "amount0Owed",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "amount1Owed",
          type: "uint256"
        },
        {
          internalType: "bytes",
          name: "data",
          type: "bytes"
        }
      ],
      name: "uniswapV3MintCallback",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "amountMinimum",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "recipient",
          type: "address"
        }
      ],
      name: "unwrapWETH9",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      stateMutability: "payable",
      type: "receive"
    }
  ],
  bytecode: "0x610120604052600d80546001600160b01b0319166001176001600160b01b0316600160b01b1790553480156200003457600080fd5b50604051620062e9380380620062e98339810160408190526200005791620002db565b82826040518060400160405280601b81526020017f556e697377617020563320506f736974696f6e73204e46542d563100000000008152506040518060400160405280600a815260200169554e492d56332d504f5360b01b815250604051806040016040528060018152602001603160f81b8152508282620000e66301ffc9a760e01b6200018d60201b60201c565b8151620000fb90600690602085019062000212565b5080516200011190600790602084019062000212565b50620001246380ac58cd60e01b6200018d565b62000136635b5e139f60e01b6200018d565b6200014863780e9d6360e01b6200018d565b50508251602093840120608052805192019190912060a052506001600160601b0319606092831b811660c05290821b811660e05291901b166101005250620003249050565b6001600160e01b03198082161415620001ed576040805162461bcd60e51b815260206004820152601c60248201527f4552433136353a20696e76616c696420696e7465726661636520696400000000604482015290519081900360640190fd5b6001600160e01b0319166000908152602081905260409020805460ff19166001179055565b828054600181600116156101000203166002900490600052602060002090601f0160209004810192826200024a576000855562000295565b82601f106200026557805160ff191683800117855562000295565b8280016001018555821562000295579182015b828111156200029557825182559160200191906001019062000278565b50620002a3929150620002a7565b5090565b5b80821115620002a35760008155600101620002a8565b80516001600160a01b0381168114620002d657600080fd5b919050565b600080600060608486031215620002f0578283fd5b620002fb84620002be565b92506200030b60208501620002be565b91506200031b60408501620002be565b90509250925092565b60805160a05160c05160601c60e05160601c6101005160601c615f40620003a960003980612a835250806102995280611718528061180e52806118965280613e5d5280613ea35280613f17525080610aa75280610dde5280610ea55280612a1d5280612b235280612e4452806136e15250806114ff5250806114de5250615f406000f3fe6080604052600436106102895760003560e01c80636352211e11610153578063ac9650d8116100cb578063d34879971161007f578063e985e9c511610064578063e985e9c5146106f5578063f3995c6714610715578063fc6f7865146107285761030d565b8063d3487997146106c2578063df2ab5bb146106e25761030d565b8063c2e3140a116100b0578063c2e3140a1461067a578063c45a01551461068d578063c87b56dd146106a25761030d565b8063ac9650d81461063a578063b88d4fde1461065a5761030d565b8063883164561161012257806399fbab881161010757806399fbab88146105cf578063a22cb46514610607578063a4a78f0c146106275761030d565b8063883164561461059757806395d89b41146105ba5761030d565b80636352211e1461052f5780636c0360eb1461054f57806370a08231146105645780637ac2ff7b146105845761030d565b806323b872dd1161020157806342966c68116101b557806349404b7c1161019a57806349404b7c146104e75780634aa4a4fc146104fa5780634f6ccce71461050f5761030d565b806342966c68146104c15780634659a494146104d45761030d565b806330adf81f116101e657806330adf81f146104775780633644e5151461048c57806342842e0e146104a15761030d565b806323b872dd146104375780632f745c59146104575761030d565b80630c49ccbe1161025857806313ead5621161023d57806313ead562146103e057806318160ddd146103f3578063219f5d17146104155761030d565b80630c49ccbe146103b757806312210e8a146103d85761030d565b806301ffc9a71461031257806306fdde0314610348578063081812fc1461036a578063095ea7b3146103975761030d565b3661030d57336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461030b576040805162461bcd60e51b815260206004820152600960248201527f4e6f742057455448390000000000000000000000000000000000000000000000604482015290519081900360640190fd5b005b600080fd5b34801561031e57600080fd5b5061033261032d3660046153a6565b61073b565b60405161033f919061591e565b60405180910390f35b34801561035457600080fd5b5061035d610776565b60405161033f9190615971565b34801561037657600080fd5b5061038a6103853660046156b8565b61080c565b60405161033f91906157e2565b3480156103a357600080fd5b5061030b6103b2366004615270565b610868565b6103ca6103c5366004615483565b61093e565b60405161033f929190615b42565b61030b610daa565b61038a6103ee366004615103565b610dbc565b3480156103ff57600080fd5b506104086110c9565b60405161033f9190615929565b610428610423366004615494565b6110da565b60405161033f93929190615afd565b34801561044357600080fd5b5061030b61045236600461515c565b611413565b34801561046357600080fd5b50610408610472366004615270565b61146a565b34801561048357600080fd5b50610408611495565b34801561049857600080fd5b506104086114b9565b3480156104ad57600080fd5b5061030b6104bc36600461515c565b611577565b61030b6104cf3660046156b8565b611592565b61030b6104e23660046152dc565b611661565b61030b6104f53660046156d0565b611714565b34801561050657600080fd5b5061038a611894565b34801561051b57600080fd5b5061040861052a3660046156b8565b6118b8565b34801561053b57600080fd5b5061038a61054a3660046156b8565b6118ce565b34801561055b57600080fd5b5061035d6118f6565b34801561057057600080fd5b5061040861057f3660046150af565b6118fb565b61030b6105923660046152dc565b611963565b6105aa6105a5366004615550565b611e0f565b60405161033f9493929190615b1e565b3480156105c657600080fd5b5061035d612370565b3480156105db57600080fd5b506105ef6105ea3660046156b8565b6123d1565b60405161033f9c9b9a99989796959493929190615b50565b34801561061357600080fd5b5061030b610622366004615243565b612600565b61030b6106353660046152dc565b612723565b61064d610648366004615337565b6127d5565b60405161033f91906158a0565b34801561066657600080fd5b5061030b61067536600461519c565b612915565b61030b6106883660046152dc565b612973565b34801561069957600080fd5b5061038a612a1b565b3480156106ae57600080fd5b5061035d6106bd3660046156b8565b612a3f565b3480156106ce57600080fd5b5061030b6106dd366004615717565b612b0e565b61030b6106f036600461529b565b612b8c565b34801561070157600080fd5b506103326107103660046150cb565b612c6f565b61030b6107233660046152dc565b612c9d565b6103ca61073636600461546c565b612d28565b7fffffffff00000000000000000000000000000000000000000000000000000000811660009081526020819052604090205460ff165b919050565b60068054604080516020601f60026000196101006001881615020190951694909404938401819004810282018101909252828152606093909290918301828280156108025780601f106107d757610100808354040283529160200191610802565b820191906000526020600020905b8154815290600101906020018083116107e557829003601f168201915b5050505050905090565b600061081782613246565b61083c5760405162461bcd60e51b8152600401610833906159bb565b60405180910390fd5b506000908152600c60205260409020546c0100000000000000000000000090046001600160a01b031690565b6000610873826118ce565b9050806001600160a01b0316836001600160a01b031614156108c65760405162461bcd60e51b8152600401808060200182810382526021815260200180615ee26021913960400191505060405180910390fd5b806001600160a01b03166108d8613253565b6001600160a01b031614806108f457506108f481610710613253565b61092f5760405162461bcd60e51b8152600401808060200182810382526038815260200180615e0c6038913960400191505060405180910390fd5b6109398383613257565b505050565b600080823561094d33826132db565b6109695760405162461bcd60e51b815260040161083390615984565b836080013580610977613377565b11156109ca576040805162461bcd60e51b815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b60006109dc6040870160208801615562565b6001600160801b0316116109ef57600080fd5b84356000908152600c602090815260409182902060018101549092600160801b9091046001600160801b031691610a2a918901908901615562565b6001600160801b0316816001600160801b03161015610a4857600080fd5b60018281015469ffffffffffffffffffff166000908152600b60209081526040808320815160608101835281546001600160a01b039081168252919095015490811692850192909252600160a01b90910462ffffff1690830152610acc7f00000000000000000000000000000000000000000000000000000000000000008361337b565b60018501549091506001600160a01b0382169063a34123a7906a01000000000000000000008104600290810b91600160681b9004900b610b1260408e0160208f01615562565b6040518463ffffffff1660e01b8152600401610b309392919061594b565b6040805180830381600087803b158015610b4957600080fd5b505af1158015610b5d573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610b8191906156f4565b909850965060408901358810801590610b9e575088606001358710155b610bba5760405162461bcd60e51b815260040161083390615a18565b6001840154600090610bea9030906a01000000000000000000008104600290810b91600160681b9004900b613477565b9050600080836001600160a01b031663514ea4bf846040518263ffffffff1660e01b8152600401610c1b9190615929565b60a06040518083038186803b158015610c3357600080fd5b505afa158015610c47573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610c6b91906155ac565b50509250925050610c9087600201548303876001600160801b0316600160801b6134d1565b6004880180546fffffffffffffffffffffffffffffffff198116928e016001600160801b039182160181169290921790556003880154610cda91908303908816600160801b6134d1565b6004880180546001600160801b03808216938e01600160801b9283900482160116029190911790556002870182905560038701819055610d2060408d0160208e01615562565b86038760010160106101000a8154816001600160801b0302191690836001600160801b031602179055508b600001357f26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b48d6020016020810190610d839190615562565b8d8d604051610d9493929190615afd565b60405180910390a2505050505050505050915091565b4715610dba57610dba3347613580565b565b6000836001600160a01b0316856001600160a01b031610610ddc57600080fd5b7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316631698ee828686866040518463ffffffff1660e01b815260040180846001600160a01b03168152602001836001600160a01b031681526020018262ffffff168152602001935050505060206040518083038186803b158015610e6757600080fd5b505afa158015610e7b573d6000803e3d6000fd5b505050506040513d6020811015610e9157600080fd5b505190506001600160a01b038116610fe0577f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031663a16712958686866040518463ffffffff1660e01b815260040180846001600160a01b03168152602001836001600160a01b031681526020018262ffffff1681526020019350505050602060405180830381600087803b158015610f3057600080fd5b505af1158015610f44573d6000803e3d6000fd5b505050506040513d6020811015610f5a57600080fd5b5051604080517ff637731d0000000000000000000000000000000000000000000000000000000081526001600160a01b03858116600483015291519293509083169163f637731d9160248082019260009290919082900301818387803b158015610fc357600080fd5b505af1158015610fd7573d6000803e3d6000fd5b505050506110c1565b6000816001600160a01b0316633850c7bd6040518163ffffffff1660e01b815260040160e06040518083038186803b15801561101b57600080fd5b505afa15801561102f573d6000803e3d6000fd5b505050506040513d60e081101561104557600080fd5b505190506001600160a01b0381166110bf57816001600160a01b031663f637731d846040518263ffffffff1660e01b815260040180826001600160a01b03168152602001915050600060405180830381600087803b1580156110a657600080fd5b505af11580156110ba573d6000803e3d6000fd5b505050505b505b949350505050565b60006110d56002613689565b905090565b60008060008360a00135806110ed613377565b1115611140576040805162461bcd60e51b815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b84356000908152600c6020908152604080832060018082015469ffffffffffffffffffff81168652600b855283862084516060808201875282546001600160a01b039081168352929094015480831682890190815262ffffff600160a01b9092048216838901908152885161014081018a528451861681529151909416818a01529251168287015230828501526a01000000000000000000008304600290810b810b608080850191909152600160681b909404810b900b60a0830152958c013560c0820152938b013560e0850152908a0135610100840152890135610120830152929061122c90613694565b6001870154939a50919850965091506000906112669030906a01000000000000000000008104600290810b91600160681b9004900b613477565b9050600080836001600160a01b031663514ea4bf846040518263ffffffff1660e01b81526004016112979190615929565b60a06040518083038186803b1580156112af57600080fd5b505afa1580156112c3573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906112e791906155ac565b50509250925050611323866002015483038760010160109054906101000a90046001600160801b03166001600160801b0316600160801b6134d1565b6004870180546001600160801b0380821690930183166fffffffffffffffffffffffffffffffff19909116179055600387015460018801546113739291840391600160801b9182900416906134d1565b6004870180546001600160801b03600160801b80830482169094018116840291811691909117909155600288018490556003880183905560018801805483810483168e018316909302929091169190911790556040518b35907f3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f906113fd908d908d908d90615afd565b60405180910390a2505050505050509193909250565b61142461141e613253565b826132db565b61145f5760405162461bcd60e51b8152600401808060200182810382526031815260200180615f036031913960400191505060405180910390fd5b6109398383836138cf565b6001600160a01b038216600090815260016020526040812061148c9083613a1b565b90505b92915050565b7f49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad81565b60007f8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f7f00000000000000000000000000000000000000000000000000000000000000007f0000000000000000000000000000000000000000000000000000000000000000611526613a27565b3060405160200180868152602001858152602001848152602001838152602001826001600160a01b031681526020019550505050505060405160208183030381529060405280519060200120905090565b61093983838360405180602001604052806000815250612915565b8061159d33826132db565b6115b95760405162461bcd60e51b815260040161083390615984565b6000828152600c602052604090206001810154600160801b90046001600160801b03161580156115f4575060048101546001600160801b0316155b801561161257506004810154600160801b90046001600160801b0316155b61162e5760405162461bcd60e51b815260040161083390615a86565b6000838152600c602052604081208181556001810182905560028101829055600381018290556004015561093983613a2b565b604080517f8fcbaf0c00000000000000000000000000000000000000000000000000000000815233600482015230602482015260448101879052606481018690526001608482015260ff851660a482015260c4810184905260e4810183905290516001600160a01b03881691638fcbaf0c9161010480830192600092919082900301818387803b1580156116f457600080fd5b505af1158015611708573d6000803e3d6000fd5b50505050505050505050565b60007f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03166370a08231306040518263ffffffff1660e01b815260040180826001600160a01b0316815260200191505060206040518083038186803b15801561178357600080fd5b505afa158015611797573d6000803e3d6000fd5b505050506040513d60208110156117ad57600080fd5b5051905082811015611806576040805162461bcd60e51b815260206004820152601260248201527f496e73756666696369656e742057455448390000000000000000000000000000604482015290519081900360640190fd5b8015610939577f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316632e1a7d4d826040518263ffffffff1660e01b815260040180828152602001915050600060405180830381600087803b15801561187257600080fd5b505af1158015611886573d6000803e3d6000fd5b505050506109398282613580565b7f000000000000000000000000000000000000000000000000000000000000000081565b6000806118c6600284613af8565b509392505050565b600061148f82604051806060016040528060298152602001615e6e6029913960029190613b16565b606090565b60006001600160a01b0382166119425760405162461bcd60e51b815260040180806020018281038252602a815260200180615e44602a913960400191505060405180910390fd5b6001600160a01b038216600090815260016020526040902061148f90613689565b8361196c613377565b11156119bf576040805162461bcd60e51b815260206004820152600e60248201527f5065726d69742065787069726564000000000000000000000000000000000000604482015290519081900360640190fd5b60006119c96114b9565b7f49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad88886119f581613b23565b604080516020808201969096526001600160a01b03909416848201526060840192909252608083015260a08083018a90528151808403909101815260c0830182528051908401207f190100000000000000000000000000000000000000000000000000000000000060e084015260e283019490945261010280830194909452805180830390940184526101229091019052815191012090506000611a98876118ce565b9050806001600160a01b0316886001600160a01b03161415611aeb5760405162461bcd60e51b8152600401808060200182810382526027815260200180615d6f6027913960400191505060405180910390fd5b611af481613b62565b15611ccf576040805160208082018790528183018690527fff0000000000000000000000000000000000000000000000000000000000000060f889901b16606083015282516041818403018152606183018085527f1626ba7e0000000000000000000000000000000000000000000000000000000090526065830186815260858401948552815160a585015281516001600160a01b03871695631626ba7e958995919260c59091019185019080838360005b83811015611bbe578181015183820152602001611ba6565b50505050905090810190601f168015611beb5780820380516001836020036101000a031916815260200191505b50935050505060206040518083038186803b158015611c0957600080fd5b505afa158015611c1d573d6000803e3d6000fd5b505050506040513d6020811015611c3357600080fd5b50517fffffffff00000000000000000000000000000000000000000000000000000000167f1626ba7e0000000000000000000000000000000000000000000000000000000014611cca576040805162461bcd60e51b815260206004820152600c60248201527f556e617574686f72697a65640000000000000000000000000000000000000000604482015290519081900360640190fd5b611dfb565b600060018387878760405160008152602001604052604051808581526020018460ff1681526020018381526020018281526020019450505050506020604051602081039080840390855afa158015611d2b573d6000803e3d6000fd5b5050604051601f1901519150506001600160a01b038116611d93576040805162461bcd60e51b815260206004820152601160248201527f496e76616c6964207369676e6174757265000000000000000000000000000000604482015290519081900360640190fd5b816001600160a01b0316816001600160a01b031614611df9576040805162461bcd60e51b815260206004820152600c60248201527f556e617574686f72697a65640000000000000000000000000000000000000000604482015290519081900360640190fd5b505b611e058888613257565b5050505050505050565b60008060008084610140013580611e24613377565b1115611e77576040805162461bcd60e51b815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b604080516101408101909152600090611f439080611e9860208b018b6150af565b6001600160a01b03168152602001896020016020810190611eb991906150af565b6001600160a01b03168152602001611ed760608b0160408c0161569e565b62ffffff168152306020820152604001611ef760808b0160608c016153e6565b60020b8152602001611f0f60a08b0160808c016153e6565b60020b81526020018960a0013581526020018960c0013581526020018960e001358152602001896101000135815250613694565b92975090955093509050611fb7611f6261014089016101208a016150af565b600d80547fffffffffffffffffffff000000000000000000000000000000000000000000008116600175ffffffffffffffffffffffffffffffffffffffffffff92831690810190921617909155975087613b68565b6000611fe230611fcd60808b0160608c016153e6565b611fdd60a08c0160808d016153e6565b613477565b9050600080836001600160a01b031663514ea4bf846040518263ffffffff1660e01b81526004016120139190615929565b60a06040518083038186803b15801561202b57600080fd5b505afa15801561203f573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061206391906155ac565b5050925092505060006120dc8560405180606001604052808e600001602081019061208e91906150af565b6001600160a01b031681526020018e60200160208101906120af91906150af565b6001600160a01b031681526020018e60400160208101906120d0919061569e565b62ffffff169052613c96565b905060405180610140016040528060006bffffffffffffffffffffffff16815260200160006001600160a01b031681526020018269ffffffffffffffffffff1681526020018c606001602081019061213491906153e6565b60020b815260200161214c60a08e0160808f016153e6565b60020b81526020018a6001600160801b0316815260200184815260200183815260200160006001600160801b0316815260200160006001600160801b0316815250600c60008c815260200190815260200160002060008201518160000160006101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff160217905550602082015181600001600c6101000a8154816001600160a01b0302191690836001600160a01b0316021790555060408201518160010160006101000a81548169ffffffffffffffffffff021916908369ffffffffffffffffffff160217905550606082015181600101600a6101000a81548162ffffff021916908360020b62ffffff160217905550608082015181600101600d6101000a81548162ffffff021916908360020b62ffffff16021790555060a08201518160010160106101000a8154816001600160801b0302191690836001600160801b0316021790555060c0820151816002015560e082015181600301556101008201518160040160006101000a8154816001600160801b0302191690836001600160801b031602179055506101208201518160040160106101000a8154816001600160801b0302191690836001600160801b03160217905550905050897f3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f8a8a8a60405161235b93929190615afd565b60405180910390a25050505050509193509193565b60078054604080516020601f60026000196101006001881615020190951694909404938401819004810282018101909252828152606093909290918301828280156108025780601f106107d757610100808354040283529160200191610802565b6000818152600c6020908152604080832081516101408101835281546bffffffffffffffffffffffff811682526001600160a01b036c010000000000000000000000009091041693810193909352600181015469ffffffffffffffffffff81169284018390526a01000000000000000000008104600290810b810b810b6060860152600160681b8204810b810b810b60808601526001600160801b03600160801b92839004811660a08701529083015460c0860152600383015460e0860152600490920154808316610100860152041661012083015282918291829182918291829182918291829182918291906124da5760405162461bcd60e51b815260040161083390615a4f565b6000600b6000836040015169ffffffffffffffffffff1669ffffffffffffffffffff1681526020019081526020016000206040518060600160405290816000820160009054906101000a90046001600160a01b03166001600160a01b03166001600160a01b031681526020016001820160009054906101000a90046001600160a01b03166001600160a01b03166001600160a01b031681526020016001820160149054906101000a900462ffffff1662ffffff1662ffffff1681525050905081600001518260200151826000015183602001518460400151866060015187608001518860a001518960c001518a60e001518b61010001518c61012001519d509d509d509d509d509d509d509d509d509d509d509d50505091939597999b5091939597999b565b612608613253565b6001600160a01b0316826001600160a01b0316141561266e576040805162461bcd60e51b815260206004820152601960248201527f4552433732313a20617070726f766520746f2063616c6c657200000000000000604482015290519081900360640190fd5b806005600061267b613253565b6001600160a01b0390811682526020808301939093526040918201600090812091871680825291909352912080547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0016921515929092179091556126dd613253565b6001600160a01b03167f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c318360405180821515815260200191505060405180910390a35050565b604080517fdd62ed3e0000000000000000000000000000000000000000000000000000000081523360048201523060248201529051600019916001600160a01b0389169163dd62ed3e91604480820192602092909190829003018186803b15801561278d57600080fd5b505afa1580156127a1573d6000803e3d6000fd5b505050506040513d60208110156127b757600080fd5b505110156127cd576127cd868686868686611661565b505050505050565b60608167ffffffffffffffff811180156127ee57600080fd5b5060405190808252806020026020018201604052801561282257816020015b606081526020019060019003908161280d5790505b50905060005b8281101561290e576000803086868581811061284057fe5b90506020028101906128529190615bef565b6040516128609291906157d2565b600060405180830381855af49150503d806000811461289b576040519150601f19603f3d011682016040523d82523d6000602084013e6128a0565b606091505b5091509150816128ec576044815110156128b957600080fd5b600481019050808060200190518101906128d39190615402565b60405162461bcd60e51b81526004016108339190615971565b808484815181106128f957fe5b60209081029190910101525050600101612828565b5092915050565b612926612920613253565b836132db565b6129615760405162461bcd60e51b8152600401808060200182810382526031815260200180615f036031913960400191505060405180910390fd5b61296d84848484613de6565b50505050565b604080517fdd62ed3e000000000000000000000000000000000000000000000000000000008152336004820152306024820152905186916001600160a01b0389169163dd62ed3e91604480820192602092909190829003018186803b1580156129db57600080fd5b505afa1580156129ef573d6000803e3d6000fd5b505050506040513d6020811015612a0557600080fd5b505110156127cd576127cd868686868686612c9d565b7f000000000000000000000000000000000000000000000000000000000000000081565b6060612a4a82613246565b612a5357600080fd5b6040517fe9dc63750000000000000000000000000000000000000000000000000000000081526001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000169063e9dc637590612aba9030908690600401615932565b60006040518083038186803b158015612ad257600080fd5b505afa158015612ae6573d6000803e3d6000fd5b505050506040513d6000823e601f3d908101601f1916820160405261148f9190810190615402565b6000612b1c828401846154a5565b9050612b4c7f00000000000000000000000000000000000000000000000000000000000000008260000151613e38565b508415612b67578051516020820151612b6791903388613e5b565b8315612b8557612b8581600001516020015182602001513387613e5b565b5050505050565b6000836001600160a01b03166370a08231306040518263ffffffff1660e01b815260040180826001600160a01b0316815260200191505060206040518083038186803b158015612bdb57600080fd5b505afa158015612bef573d6000803e3d6000fd5b505050506040513d6020811015612c0557600080fd5b5051905082811015612c5e576040805162461bcd60e51b815260206004820152601260248201527f496e73756666696369656e7420746f6b656e0000000000000000000000000000604482015290519081900360640190fd5b801561296d5761296d848383613feb565b6001600160a01b03918216600090815260056020908152604080832093909416825291909152205460ff1690565b604080517fd505accf000000000000000000000000000000000000000000000000000000008152336004820152306024820152604481018790526064810186905260ff8516608482015260a4810184905260c4810183905290516001600160a01b0388169163d505accf9160e480830192600092919082900301818387803b1580156116f457600080fd5b6000808235612d3733826132db565b612d535760405162461bcd60e51b815260040161083390615984565b6000612d656060860160408701615562565b6001600160801b03161180612d9257506000612d876080860160608701615562565b6001600160801b0316115b612d9b57600080fd5b600080612dae60408701602088016150af565b6001600160a01b031614612dd157612dcc60408601602087016150af565b612dd3565b305b85356000908152600c6020908152604080832060018082015469ffffffffffffffffffff168552600b8452828520835160608101855281546001600160a01b039081168252919092015490811694820194909452600160a01b90930462ffffff169183019190915292935090612e697f00000000000000000000000000000000000000000000000000000000000000008361337b565b600484015460018501549192506001600160801b0380821692600160801b92839004821692900416156130865760018501546040517fa34123a70000000000000000000000000000000000000000000000000000000081526001600160a01b0385169163a34123a791612f00916a01000000000000000000008104600290810b92600160681b909204900b9060009060040161594b565b6040805180830381600087803b158015612f1957600080fd5b505af1158015612f2d573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190612f5191906156f4565b5050600185015460009081906001600160a01b0386169063514ea4bf90612f969030906a01000000000000000000008104600290810b91600160681b9004900b613477565b6040518263ffffffff1660e01b8152600401612fb29190615929565b60a06040518083038186803b158015612fca57600080fd5b505afa158015612fde573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061300291906155ac565b5050925092505061303e876002015483038860010160109054906101000a90046001600160801b03166001600160801b0316600160801b6134d1565b84019350613077876003015482038860010160109054906101000a90046001600160801b03166001600160801b0316600160801b6134d1565b60028801929092556003870155015b6000806001600160801b0384166130a360608e0160408f01615562565b6001600160801b0316116130c6576130c160608d0160408e01615562565b6130c8565b835b836001600160801b03168d60600160208101906130e59190615562565b6001600160801b0316116131085761310360808e0160608f01615562565b61310a565b835b60018901546040517f4f1eb3d80000000000000000000000000000000000000000000000000000000081529294509092506001600160a01b03871691634f1eb3d89161317d918c916a01000000000000000000008104600290810b92600160681b909204900b9088908890600401615839565b6040805180830381600087803b15801561319657600080fd5b505af11580156131aa573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906131ce919061557e565b6004890180546fffffffffffffffffffffffffffffffff196001600160801b03918216600160801b878a0384160217168689038216179091556040519281169d50169a508c35907f40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f0190610d94908b9086908690615876565b600061148f60028361417b565b3390565b6000818152600c6020526040902080546bffffffffffffffffffffffff166c010000000000000000000000006001600160a01b0385169081029190911790915581906132a2826118ce565b6001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45050565b60006132e682613246565b6133215760405162461bcd60e51b815260040180806020018281038252602c815260200180615de0602c913960400191505060405180910390fd5b600061332c836118ce565b9050806001600160a01b0316846001600160a01b031614806133675750836001600160a01b031661335c8461080c565b6001600160a01b0316145b806110c157506110c18185612c6f565b4290565b600081602001516001600160a01b031682600001516001600160a01b0316106133a357600080fd5b50805160208083015160409384015184516001600160a01b0394851681850152939091168385015262ffffff166060808401919091528351808403820181526080840185528051908301207fff0000000000000000000000000000000000000000000000000000000000000060a085015294901b6bffffffffffffffffffffffff191660a183015260b58201939093527fe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b5460d5808301919091528251808303909101815260f5909101909152805191012090565b604080516bffffffffffffffffffffffff19606086901b16602080830191909152600285810b60e890811b60348501529085900b901b60378301528251601a818403018152603a90920190925280519101205b9392505050565b600080806000198587098686029250828110908390030390508061350757600084116134fc57600080fd5b5082900490506134ca565b80841161351357600080fd5b6000848688096000868103871696879004966002600389028118808a02820302808a02820302808a02820302808a02820302808a02820302808a02909103029181900381900460010186841190950394909402919094039290920491909117919091029150509392505050565b604080516000808252602082019092526001600160a01b0384169083906040518082805190602001908083835b602083106135cc5780518252601f1990920191602091820191016135ad565b6001836020036101000a03801982511681845116808217855250505050505090500191505060006040518083038185875af1925050503d806000811461362e576040519150601f19603f3d011682016040523d82523d6000602084013e613633565b606091505b5050905080610939576040805162461bcd60e51b815260206004820152600360248201527f5354450000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b600061148f82614187565b6000806000806000604051806060016040528087600001516001600160a01b0316815260200187602001516001600160a01b03168152602001876040015162ffffff1681525090506137067f00000000000000000000000000000000000000000000000000000000000000008261337b565b91506000826001600160a01b0316633850c7bd6040518163ffffffff1660e01b815260040160e06040518083038186803b15801561374357600080fd5b505afa158015613757573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061377b919061560d565b50505050505090506000613792886080015161418b565b905060006137a38960a0015161418b565b90506137ba8383838c60c001518d60e001516144d9565b9750505050816001600160a01b0316633c8a7d8d876060015188608001518960a00151896040518060400160405280888152602001336001600160a01b031681525060405160200161380c9190615abd565b6040516020818303038152906040526040518663ffffffff1660e01b815260040161383b9594939291906157f6565b6040805180830381600087803b15801561385457600080fd5b505af1158015613868573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061388c91906156f4565b610100880151919550935084108015906138ab57508561012001518310155b6138c75760405162461bcd60e51b815260040161083390615a18565b509193509193565b826001600160a01b03166138e2826118ce565b6001600160a01b0316146139275760405162461bcd60e51b8152600401808060200182810382526029815260200180615eb96029913960400191505060405180910390fd5b6001600160a01b03821661396c5760405162461bcd60e51b8152600401808060200182810382526024815260200180615d966024913960400191505060405180910390fd5b613977838383610939565b613982600082613257565b6001600160a01b03831660009081526001602052604090206139a4908261459d565b506001600160a01b03821660009081526001602052604090206139c790826145a9565b506139d4600282846145b5565b5080826001600160a01b0316846001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef60405160405180910390a4505050565b600061148c83836145cb565b4690565b6000613a36826118ce565b9050613a4481600084610939565b613a4f600083613257565b6000828152600860205260409020546002600019610100600184161502019091160415613a8d576000828152600860205260408120613a8d9161501f565b6001600160a01b0381166000908152600160205260409020613aaf908361459d565b50613abb60028361462f565b5060405182906000906001600160a01b038416907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908390a45050565b6000808080613b07868661463b565b909450925050505b9250929050565b60006110c18484846146b6565b6000908152600c6020526040902080546bffffffffffffffffffffffff19811660016bffffffffffffffffffffffff9283169081019092161790915590565b3b151590565b6001600160a01b038216613bc3576040805162461bcd60e51b815260206004820181905260248201527f4552433732313a206d696e7420746f20746865207a65726f2061646472657373604482015290519081900360640190fd5b613bcc81613246565b15613c1e576040805162461bcd60e51b815260206004820152601c60248201527f4552433732313a20746f6b656e20616c7265616479206d696e74656400000000604482015290519081900360640190fd5b613c2a60008383610939565b6001600160a01b0382166000908152600160205260409020613c4c90826145a9565b50613c59600282846145b5565b5060405181906001600160a01b038416906000907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908290a45050565b6001600160a01b0382166000908152600a602052604090205469ffffffffffffffffffff168061148f5750600d8054600169ffffffffffffffffffff76010000000000000000000000000000000000000000000080840482168381019092160275ffffffffffffffffffffffffffffffffffffffffffff909316929092179092556001600160a01b038085166000908152600a6020908152604080832080547fffffffffffffffffffffffffffffffffffffffffffff000000000000000000001686179055848352600b825291829020865181549085167fffffffffffffffffffffffff000000000000000000000000000000000000000091821617825591870151950180549287015162ffffff16600160a01b027fffffffffffffffffff000000ffffffffffffffffffffffffffffffffffffffff969094169290911691909117939093161790915592915050565b613df18484846138cf565b613dfd84848484614780565b61296d5760405162461bcd60e51b8152600401808060200182810382526032815260200180615d3d6032913960400191505060405180910390fd5b6000613e44838361337b565b9050336001600160a01b0382161461148f57600080fd5b7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316846001600160a01b0316148015613e9c5750804710155b15613fbe577f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031663d0e30db0826040518263ffffffff1660e01b81526004016000604051808303818588803b158015613efc57600080fd5b505af1158015613f10573d6000803e3d6000fd5b50505050507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031663a9059cbb83836040518363ffffffff1660e01b815260040180836001600160a01b0316815260200182815260200192505050602060405180830381600087803b158015613f8c57600080fd5b505af1158015613fa0573d6000803e3d6000fd5b505050506040513d6020811015613fb657600080fd5b5061296d9050565b6001600160a01b038316301415613fdf57613fda848383613feb565b61296d565b61296d8484848461495c565b604080516001600160a01b038481166024830152604480830185905283518084039091018152606490920183526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167fa9059cbb000000000000000000000000000000000000000000000000000000001781529251825160009485949389169392918291908083835b602083106140955780518252601f199092019160209182019101614076565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d80600081146140f7576040519150601f19603f3d011682016040523d82523d6000602084013e6140fc565b606091505b509150915081801561412a57508051158061412a575080806020019051602081101561412757600080fd5b50515b612b85576040805162461bcd60e51b815260206004820152600260248201527f5354000000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b600061148c8383614af4565b5490565b60008060008360020b126141a2578260020b6141aa565b8260020b6000035b9050620d89e8811115614204576040805162461bcd60e51b815260206004820152600160248201527f5400000000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b60006001821661421857600160801b61422a565b6ffffcb933bd6fad37aa2d162d1a5940015b70ffffffffffffffffffffffffffffffffff169050600282161561425e576ffff97272373d413259a46990580e213a0260801c5b600482161561427d576ffff2e50f5f656932ef12357cf3c7fdcc0260801c5b600882161561429c576fffe5caca7e10e4e61c3624eaa0941cd00260801c5b60108216156142bb576fffcb9843d60f6159c9db58835c9266440260801c5b60208216156142da576fff973b41fa98c081472e6896dfb254c00260801c5b60408216156142f9576fff2ea16466c96a3843ec78b326b528610260801c5b6080821615614318576ffe5dee046a99a2a811c461f1969c30530260801c5b610100821615614338576ffcbe86c7900a88aedcffc83b479aa3a40260801c5b610200821615614358576ff987a7253ac413176f2b074cf7815e540260801c5b610400821615614378576ff3392b0822b70005940c7a398e4b70f30260801c5b610800821615614398576fe7159475a2c29b7443b29c7fa6e889d90260801c5b6110008216156143b8576fd097f3bdfd2022b8845ad8f792aa58250260801c5b6120008216156143d8576fa9f746462d870fdf8a65dc1f90e061e50260801c5b6140008216156143f8576f70d869a156d2a1b890bb3df62baf32f70260801c5b618000821615614418576f31be135f97d08fd981231505542fcfa60260801c5b62010000821615614439576f09aa508b5b7a84e1c677de54f3e99bc90260801c5b62020000821615614459576e5d6af8dedb81196699c329225ee6040260801c5b62040000821615614478576d2216e584f5fa1ea926041bedfe980260801c5b62080000821615614495576b048a170391f7dc42444e8fa20260801c5b60008460020b13156144b05780600019816144ac57fe5b0490505b6401000000008106156144c45760016144c7565b60005b60ff16602082901c0192505050919050565b6000836001600160a01b0316856001600160a01b031611156144f9579293925b846001600160a01b0316866001600160a01b0316116145245761451d858585614b0c565b9050614594565b836001600160a01b0316866001600160a01b0316101561458657600061454b878686614b0c565b9050600061455a878986614b78565b9050806001600160801b0316826001600160801b03161061457b578061457d565b815b92505050614594565b614591858584614b78565b90505b95945050505050565b600061148c8383614bbe565b600061148c8383614c84565b60006110c184846001600160a01b038516614cce565b8154600090821061460d5760405162461bcd60e51b8152600401808060200182810382526022815260200180615d1b6022913960400191505060405180910390fd5b82600001828154811061461c57fe5b9060005260206000200154905092915050565b600061148c8383614d65565b81546000908190831061467f5760405162461bcd60e51b8152600401808060200182810382526022815260200180615e976022913960400191505060405180910390fd5b600084600001848154811061469057fe5b906000526020600020906002020190508060000154816001015492509250509250929050565b600082815260018401602052604081205482816147515760405162461bcd60e51b81526004018080602001828103825283818151815260200191508051906020019080838360005b838110156147165781810151838201526020016146fe565b50505050905090810190601f1680156147435780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b5084600001600182038154811061476457fe5b9060005260206000209060020201600101549150509392505050565b6000614794846001600160a01b0316613b62565b6147a0575060016110c1565b60006148f17f150b7a02000000000000000000000000000000000000000000000000000000006147ce613253565b88878760405160240180856001600160a01b03168152602001846001600160a01b0316815260200183815260200180602001828103825283818151815260200191508051906020019080838360005b8381101561483557818101518382015260200161481d565b50505050905090810190601f1680156148625780820380516001836020036101000a031916815260200191505b5095505050505050604051602081830303815290604052907bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19166020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff8381831617835250505050604051806060016040528060328152602001615d3d603291396001600160a01b0388169190614e39565b9050600081806020019051602081101561490a57600080fd5b50517fffffffff00000000000000000000000000000000000000000000000000000000167f150b7a02000000000000000000000000000000000000000000000000000000001492505050949350505050565b604080516001600160a01b0385811660248301528481166044830152606480830185905283518084039091018152608490920183526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167f23b872dd00000000000000000000000000000000000000000000000000000000178152925182516000948594938a169392918291908083835b60208310614a0e5780518252601f1990920191602091820191016149ef565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d8060008114614a70576040519150601f19603f3d011682016040523d82523d6000602084013e614a75565b606091505b5091509150818015614aa3575080511580614aa35750808060200190516020811015614aa057600080fd5b50515b6127cd576040805162461bcd60e51b815260206004820152600360248201527f5354460000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b60009081526001919091016020526040902054151590565b6000826001600160a01b0316846001600160a01b03161115614b2c579192915b6000614b58856001600160a01b0316856001600160a01b03166c010000000000000000000000006134d1565b9050614594614b7384838888036001600160a01b03166134d1565b614e48565b6000826001600160a01b0316846001600160a01b03161115614b98579192915b6110c1614b73836c010000000000000000000000008787036001600160a01b03166134d1565b60008181526001830160205260408120548015614c7a5783546000198083019190810190600090879083908110614bf157fe5b9060005260206000200154905080876000018481548110614c0e57fe5b600091825260208083209091019290925582815260018981019092526040902090840190558654879080614c3e57fe5b6001900381819060005260206000200160009055905586600101600087815260200190815260200160002060009055600194505050505061148f565b600091505061148f565b6000614c908383614af4565b614cc65750815460018181018455600084815260208082209093018490558454848252828601909352604090209190915561148f565b50600061148f565b600082815260018401602052604081205480614d335750506040805180820182528381526020808201848152865460018181018955600089815284812095516002909302909501918255915190820155865486845281880190925292909120556134ca565b82856000016001830381548110614d4657fe5b90600052602060002090600202016001018190555060009150506134ca565b60008181526001830160205260408120548015614c7a5783546000198083019190810190600090879083908110614d9857fe5b9060005260206000209060020201905080876000018481548110614db857fe5b600091825260208083208454600290930201918255600193840154918401919091558354825289830190526040902090840190558654879080614df757fe5b600082815260208082206002600019909401938402018281556001908101839055929093558881528982019092526040822091909155945061148f9350505050565b60606110c18484600085614e5e565b806001600160801b038116811461077157600080fd5b606082471015614e9f5760405162461bcd60e51b8152600401808060200182810382526026815260200180615dba6026913960400191505060405180910390fd5b614ea885613b62565b614ef9576040805162461bcd60e51b815260206004820152601d60248201527f416464726573733a2063616c6c20746f206e6f6e2d636f6e7472616374000000604482015290519081900360640190fd5b600080866001600160a01b031685876040518082805190602001908083835b60208310614f375780518252601f199092019160209182019101614f18565b6001836020036101000a03801982511681845116808217855250505050505090500191505060006040518083038185875af1925050503d8060008114614f99576040519150601f19603f3d011682016040523d82523d6000602084013e614f9e565b606091505b5091509150614fae828286614fb9565b979650505050505050565b60608315614fc85750816134ca565b825115614fd85782518084602001fd5b60405162461bcd60e51b81526020600482018181528451602484015284518593919283926044019190850190808383600083156147165781810151838201526020016146fe565b50805460018160011615610100020316600290046000825580601f106150455750615063565b601f0160209004906000526020600020908101906150639190615066565b50565b5b8082111561507b5760008155600101615067565b5090565b803561077181615cc4565b805161ffff8116811461077157600080fd5b803562ffffff8116811461077157600080fd5b6000602082840312156150c0578081fd5b81356134ca81615cc4565b600080604083850312156150dd578081fd5b82356150e881615cc4565b915060208301356150f881615cc4565b809150509250929050565b60008060008060808587031215615118578182fd5b843561512381615cc4565b9350602085013561513381615cc4565b92506151416040860161509c565b9150606085013561515181615cc4565b939692955090935050565b600080600060608486031215615170578081fd5b833561517b81615cc4565b9250602084013561518b81615cc4565b929592945050506040919091013590565b600080600080608085870312156151b1578182fd5b84356151bc81615cc4565b935060208501356151cc81615cc4565b925060408501359150606085013567ffffffffffffffff8111156151ee578182fd5b8501601f810187136151fe578182fd5b803561521161520c82615c76565b615c52565b818152886020838501011115615225578384fd5b81602084016020830137908101602001929092525092959194509250565b60008060408385031215615255578182fd5b823561526081615cc4565b915060208301356150f881615cd9565b60008060408385031215615282578182fd5b823561528d81615cc4565b946020939093013593505050565b6000806000606084860312156152af578081fd5b83356152ba81615cc4565b92506020840135915060408401356152d181615cc4565b809150509250925092565b60008060008060008060c087890312156152f4578384fd5b86356152ff81615cc4565b95506020870135945060408701359350606087013561531d81615d0b565b9598949750929560808101359460a0909101359350915050565b60008060208385031215615349578182fd5b823567ffffffffffffffff80821115615360578384fd5b818501915085601f830112615373578384fd5b813581811115615381578485fd5b8660208083028501011115615394578485fd5b60209290920196919550909350505050565b6000602082840312156153b7578081fd5b81357fffffffff00000000000000000000000000000000000000000000000000000000811681146134ca578182fd5b6000602082840312156153f7578081fd5b81356134ca81615ce7565b600060208284031215615413578081fd5b815167ffffffffffffffff811115615429578182fd5b8201601f81018413615439578182fd5b805161544761520c82615c76565b81815285602083850101111561545b578384fd5b614594826020830160208601615c98565b60006080828403121561547d578081fd5b50919050565b600060a0828403121561547d578081fd5b600060c0828403121561547d578081fd5b600081830360808112156154b7578182fd5b6040516040810167ffffffffffffffff82821081831117156154d557fe5b8160405260608412156154e6578485fd5b60a08301935081841081851117156154fa57fe5b50826040528435925061550c83615cc4565b91825260208401359161551e83615cc4565b8260608301526155306040860161509c565b608083015281526155436060850161507f565b6020820152949350505050565b6000610160828403121561547d578081fd5b600060208284031215615573578081fd5b81356134ca81615cf6565b60008060408385031215615590578182fd5b825161559b81615cf6565b60208401519092506150f881615cf6565b600080600080600060a086880312156155c3578283fd5b85516155ce81615cf6565b80955050602086015193506040860151925060608601516155ee81615cf6565b60808701519092506155ff81615cf6565b809150509295509295909350565b600080600080600080600060e0888a031215615627578485fd5b875161563281615cc4565b602089015190975061564381615ce7565b95506156516040890161508a565b945061565f6060890161508a565b935061566d6080890161508a565b925060a088015161567d81615d0b565b60c089015190925061568e81615cd9565b8091505092959891949750929550565b6000602082840312156156af578081fd5b61148c8261509c565b6000602082840312156156c9578081fd5b5035919050565b600080604083850312156156e2578182fd5b8235915060208301356150f881615cc4565b60008060408385031215615706578182fd5b505080516020909101519092909150565b6000806000806060858703121561572c578182fd5b8435935060208501359250604085013567ffffffffffffffff80821115615751578384fd5b818701915087601f830112615764578384fd5b813581811115615772578485fd5b886020828501011115615783578485fd5b95989497505060200194505050565b600081518084526157aa816020860160208601615c98565b601f01601f19169290920160200192915050565b60020b9052565b6001600160801b03169052565b6000828483379101908152919050565b6001600160a01b0391909116815260200190565b60006001600160a01b03871682528560020b60208301528460020b60408301526001600160801b038416606083015260a06080830152614fae60a0830184615792565b6001600160a01b03959095168552600293840b60208601529190920b60408401526001600160801b03918216606084015216608082015260a00190565b6001600160a01b039390931683526001600160801b03918216602084015216604082015260600190565b6000602080830181845280855180835260408601915060408482028701019250838701855b82811015615911577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc08886030184526158ff858351615792565b945092850192908501906001016158c5565b5092979650505050505050565b901515815260200190565b90815260200190565b6001600160a01b03929092168252602082015260400190565b600293840b81529190920b60208201526001600160801b03909116604082015260600190565b60006020825261148c6020830184615792565b6020808252600c908201527f4e6f7420617070726f7665640000000000000000000000000000000000000000604082015260600190565b6020808252602c908201527f4552433732313a20617070726f76656420717565727920666f72206e6f6e657860408201527f697374656e7420746f6b656e0000000000000000000000000000000000000000606082015260800190565b60208082526014908201527f507269636520736c69707061676520636865636b000000000000000000000000604082015260600190565b60208082526010908201527f496e76616c696420746f6b656e20494400000000000000000000000000000000604082015260600190565b6020808252600b908201527f4e6f7420636c6561726564000000000000000000000000000000000000000000604082015260600190565b815180516001600160a01b03908116835260208083015182168185015260409283015162ffffff1692840192909252920151909116606082015260800190565b6001600160801b039390931683526020830191909152604082015260600190565b9384526001600160801b039290921660208401526040830152606082015260800190565b918252602082015260400190565b6bffffffffffffffffffffffff8d1681526001600160a01b038c811660208301528b811660408301528a16606082015262ffffff89166080820152600288900b60a08201526101808101615ba760c08301896157be565b615bb460e08301886157c5565b8561010083015284610120830152615bd06101408301856157c5565b615bde6101608301846157c5565b9d9c50505050505050505050505050565b60008083357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe1843603018112615c23578283fd5b83018035915067ffffffffffffffff821115615c3d578283fd5b602001915036819003821315613b0f57600080fd5b60405181810167ffffffffffffffff81118282101715615c6e57fe5b604052919050565b600067ffffffffffffffff821115615c8a57fe5b50601f01601f191660200190565b60005b83811015615cb3578181015183820152602001615c9b565b8381111561296d5750506000910152565b6001600160a01b038116811461506357600080fd5b801515811461506357600080fd5b8060020b811461506357600080fd5b6001600160801b038116811461506357600080fd5b60ff8116811461506357600080fdfe456e756d657261626c655365743a20696e646578206f7574206f6620626f756e64734552433732313a207472616e7366657220746f206e6f6e20455243373231526563656976657220696d706c656d656e7465724552433732315065726d69743a20617070726f76616c20746f2063757272656e74206f776e65724552433732313a207472616e7366657220746f20746865207a65726f2061646472657373416464726573733a20696e73756666696369656e742062616c616e636520666f722063616c6c4552433732313a206f70657261746f7220717565727920666f72206e6f6e6578697374656e7420746f6b656e4552433732313a20617070726f76652063616c6c6572206973206e6f74206f776e6572206e6f7220617070726f76656420666f7220616c6c4552433732313a2062616c616e636520717565727920666f7220746865207a65726f20616464726573734552433732313a206f776e657220717565727920666f72206e6f6e6578697374656e7420746f6b656e456e756d657261626c654d61703a20696e646578206f7574206f6620626f756e64734552433732313a207472616e73666572206f6620746f6b656e2074686174206973206e6f74206f776e4552433732313a20617070726f76616c20746f2063757272656e74206f776e65724552433732313a207472616e736665722063616c6c6572206973206e6f74206f776e6572206e6f7220617070726f766564a164736f6c6343000706000a",
  deployedBytecode: "0x6080604052600436106102895760003560e01c80636352211e11610153578063ac9650d8116100cb578063d34879971161007f578063e985e9c511610064578063e985e9c5146106f5578063f3995c6714610715578063fc6f7865146107285761030d565b8063d3487997146106c2578063df2ab5bb146106e25761030d565b8063c2e3140a116100b0578063c2e3140a1461067a578063c45a01551461068d578063c87b56dd146106a25761030d565b8063ac9650d81461063a578063b88d4fde1461065a5761030d565b8063883164561161012257806399fbab881161010757806399fbab88146105cf578063a22cb46514610607578063a4a78f0c146106275761030d565b8063883164561461059757806395d89b41146105ba5761030d565b80636352211e1461052f5780636c0360eb1461054f57806370a08231146105645780637ac2ff7b146105845761030d565b806323b872dd1161020157806342966c68116101b557806349404b7c1161019a57806349404b7c146104e75780634aa4a4fc146104fa5780634f6ccce71461050f5761030d565b806342966c68146104c15780634659a494146104d45761030d565b806330adf81f116101e657806330adf81f146104775780633644e5151461048c57806342842e0e146104a15761030d565b806323b872dd146104375780632f745c59146104575761030d565b80630c49ccbe1161025857806313ead5621161023d57806313ead562146103e057806318160ddd146103f3578063219f5d17146104155761030d565b80630c49ccbe146103b757806312210e8a146103d85761030d565b806301ffc9a71461031257806306fdde0314610348578063081812fc1461036a578063095ea7b3146103975761030d565b3661030d57336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461030b576040805162461bcd60e51b815260206004820152600960248201527f4e6f742057455448390000000000000000000000000000000000000000000000604482015290519081900360640190fd5b005b600080fd5b34801561031e57600080fd5b5061033261032d3660046153a6565b61073b565b60405161033f919061591e565b60405180910390f35b34801561035457600080fd5b5061035d610776565b60405161033f9190615971565b34801561037657600080fd5b5061038a6103853660046156b8565b61080c565b60405161033f91906157e2565b3480156103a357600080fd5b5061030b6103b2366004615270565b610868565b6103ca6103c5366004615483565b61093e565b60405161033f929190615b42565b61030b610daa565b61038a6103ee366004615103565b610dbc565b3480156103ff57600080fd5b506104086110c9565b60405161033f9190615929565b610428610423366004615494565b6110da565b60405161033f93929190615afd565b34801561044357600080fd5b5061030b61045236600461515c565b611413565b34801561046357600080fd5b50610408610472366004615270565b61146a565b34801561048357600080fd5b50610408611495565b34801561049857600080fd5b506104086114b9565b3480156104ad57600080fd5b5061030b6104bc36600461515c565b611577565b61030b6104cf3660046156b8565b611592565b61030b6104e23660046152dc565b611661565b61030b6104f53660046156d0565b611714565b34801561050657600080fd5b5061038a611894565b34801561051b57600080fd5b5061040861052a3660046156b8565b6118b8565b34801561053b57600080fd5b5061038a61054a3660046156b8565b6118ce565b34801561055b57600080fd5b5061035d6118f6565b34801561057057600080fd5b5061040861057f3660046150af565b6118fb565b61030b6105923660046152dc565b611963565b6105aa6105a5366004615550565b611e0f565b60405161033f9493929190615b1e565b3480156105c657600080fd5b5061035d612370565b3480156105db57600080fd5b506105ef6105ea3660046156b8565b6123d1565b60405161033f9c9b9a99989796959493929190615b50565b34801561061357600080fd5b5061030b610622366004615243565b612600565b61030b6106353660046152dc565b612723565b61064d610648366004615337565b6127d5565b60405161033f91906158a0565b34801561066657600080fd5b5061030b61067536600461519c565b612915565b61030b6106883660046152dc565b612973565b34801561069957600080fd5b5061038a612a1b565b3480156106ae57600080fd5b5061035d6106bd3660046156b8565b612a3f565b3480156106ce57600080fd5b5061030b6106dd366004615717565b612b0e565b61030b6106f036600461529b565b612b8c565b34801561070157600080fd5b506103326107103660046150cb565b612c6f565b61030b6107233660046152dc565b612c9d565b6103ca61073636600461546c565b612d28565b7fffffffff00000000000000000000000000000000000000000000000000000000811660009081526020819052604090205460ff165b919050565b60068054604080516020601f60026000196101006001881615020190951694909404938401819004810282018101909252828152606093909290918301828280156108025780601f106107d757610100808354040283529160200191610802565b820191906000526020600020905b8154815290600101906020018083116107e557829003601f168201915b5050505050905090565b600061081782613246565b61083c5760405162461bcd60e51b8152600401610833906159bb565b60405180910390fd5b506000908152600c60205260409020546c0100000000000000000000000090046001600160a01b031690565b6000610873826118ce565b9050806001600160a01b0316836001600160a01b031614156108c65760405162461bcd60e51b8152600401808060200182810382526021815260200180615ee26021913960400191505060405180910390fd5b806001600160a01b03166108d8613253565b6001600160a01b031614806108f457506108f481610710613253565b61092f5760405162461bcd60e51b8152600401808060200182810382526038815260200180615e0c6038913960400191505060405180910390fd5b6109398383613257565b505050565b600080823561094d33826132db565b6109695760405162461bcd60e51b815260040161083390615984565b836080013580610977613377565b11156109ca576040805162461bcd60e51b815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b60006109dc6040870160208801615562565b6001600160801b0316116109ef57600080fd5b84356000908152600c602090815260409182902060018101549092600160801b9091046001600160801b031691610a2a918901908901615562565b6001600160801b0316816001600160801b03161015610a4857600080fd5b60018281015469ffffffffffffffffffff166000908152600b60209081526040808320815160608101835281546001600160a01b039081168252919095015490811692850192909252600160a01b90910462ffffff1690830152610acc7f00000000000000000000000000000000000000000000000000000000000000008361337b565b60018501549091506001600160a01b0382169063a34123a7906a01000000000000000000008104600290810b91600160681b9004900b610b1260408e0160208f01615562565b6040518463ffffffff1660e01b8152600401610b309392919061594b565b6040805180830381600087803b158015610b4957600080fd5b505af1158015610b5d573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610b8191906156f4565b909850965060408901358810801590610b9e575088606001358710155b610bba5760405162461bcd60e51b815260040161083390615a18565b6001840154600090610bea9030906a01000000000000000000008104600290810b91600160681b9004900b613477565b9050600080836001600160a01b031663514ea4bf846040518263ffffffff1660e01b8152600401610c1b9190615929565b60a06040518083038186803b158015610c3357600080fd5b505afa158015610c47573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610c6b91906155ac565b50509250925050610c9087600201548303876001600160801b0316600160801b6134d1565b6004880180546fffffffffffffffffffffffffffffffff198116928e016001600160801b039182160181169290921790556003880154610cda91908303908816600160801b6134d1565b6004880180546001600160801b03808216938e01600160801b9283900482160116029190911790556002870182905560038701819055610d2060408d0160208e01615562565b86038760010160106101000a8154816001600160801b0302191690836001600160801b031602179055508b600001357f26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b48d6020016020810190610d839190615562565b8d8d604051610d9493929190615afd565b60405180910390a2505050505050505050915091565b4715610dba57610dba3347613580565b565b6000836001600160a01b0316856001600160a01b031610610ddc57600080fd5b7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316631698ee828686866040518463ffffffff1660e01b815260040180846001600160a01b03168152602001836001600160a01b031681526020018262ffffff168152602001935050505060206040518083038186803b158015610e6757600080fd5b505afa158015610e7b573d6000803e3d6000fd5b505050506040513d6020811015610e9157600080fd5b505190506001600160a01b038116610fe0577f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031663a16712958686866040518463ffffffff1660e01b815260040180846001600160a01b03168152602001836001600160a01b031681526020018262ffffff1681526020019350505050602060405180830381600087803b158015610f3057600080fd5b505af1158015610f44573d6000803e3d6000fd5b505050506040513d6020811015610f5a57600080fd5b5051604080517ff637731d0000000000000000000000000000000000000000000000000000000081526001600160a01b03858116600483015291519293509083169163f637731d9160248082019260009290919082900301818387803b158015610fc357600080fd5b505af1158015610fd7573d6000803e3d6000fd5b505050506110c1565b6000816001600160a01b0316633850c7bd6040518163ffffffff1660e01b815260040160e06040518083038186803b15801561101b57600080fd5b505afa15801561102f573d6000803e3d6000fd5b505050506040513d60e081101561104557600080fd5b505190506001600160a01b0381166110bf57816001600160a01b031663f637731d846040518263ffffffff1660e01b815260040180826001600160a01b03168152602001915050600060405180830381600087803b1580156110a657600080fd5b505af11580156110ba573d6000803e3d6000fd5b505050505b505b949350505050565b60006110d56002613689565b905090565b60008060008360a00135806110ed613377565b1115611140576040805162461bcd60e51b815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b84356000908152600c6020908152604080832060018082015469ffffffffffffffffffff81168652600b855283862084516060808201875282546001600160a01b039081168352929094015480831682890190815262ffffff600160a01b9092048216838901908152885161014081018a528451861681529151909416818a01529251168287015230828501526a01000000000000000000008304600290810b810b608080850191909152600160681b909404810b900b60a0830152958c013560c0820152938b013560e0850152908a0135610100840152890135610120830152929061122c90613694565b6001870154939a50919850965091506000906112669030906a01000000000000000000008104600290810b91600160681b9004900b613477565b9050600080836001600160a01b031663514ea4bf846040518263ffffffff1660e01b81526004016112979190615929565b60a06040518083038186803b1580156112af57600080fd5b505afa1580156112c3573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906112e791906155ac565b50509250925050611323866002015483038760010160109054906101000a90046001600160801b03166001600160801b0316600160801b6134d1565b6004870180546001600160801b0380821690930183166fffffffffffffffffffffffffffffffff19909116179055600387015460018801546113739291840391600160801b9182900416906134d1565b6004870180546001600160801b03600160801b80830482169094018116840291811691909117909155600288018490556003880183905560018801805483810483168e018316909302929091169190911790556040518b35907f3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f906113fd908d908d908d90615afd565b60405180910390a2505050505050509193909250565b61142461141e613253565b826132db565b61145f5760405162461bcd60e51b8152600401808060200182810382526031815260200180615f036031913960400191505060405180910390fd5b6109398383836138cf565b6001600160a01b038216600090815260016020526040812061148c9083613a1b565b90505b92915050565b7f49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad81565b60007f8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f7f00000000000000000000000000000000000000000000000000000000000000007f0000000000000000000000000000000000000000000000000000000000000000611526613a27565b3060405160200180868152602001858152602001848152602001838152602001826001600160a01b031681526020019550505050505060405160208183030381529060405280519060200120905090565b61093983838360405180602001604052806000815250612915565b8061159d33826132db565b6115b95760405162461bcd60e51b815260040161083390615984565b6000828152600c602052604090206001810154600160801b90046001600160801b03161580156115f4575060048101546001600160801b0316155b801561161257506004810154600160801b90046001600160801b0316155b61162e5760405162461bcd60e51b815260040161083390615a86565b6000838152600c602052604081208181556001810182905560028101829055600381018290556004015561093983613a2b565b604080517f8fcbaf0c00000000000000000000000000000000000000000000000000000000815233600482015230602482015260448101879052606481018690526001608482015260ff851660a482015260c4810184905260e4810183905290516001600160a01b03881691638fcbaf0c9161010480830192600092919082900301818387803b1580156116f457600080fd5b505af1158015611708573d6000803e3d6000fd5b50505050505050505050565b60007f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03166370a08231306040518263ffffffff1660e01b815260040180826001600160a01b0316815260200191505060206040518083038186803b15801561178357600080fd5b505afa158015611797573d6000803e3d6000fd5b505050506040513d60208110156117ad57600080fd5b5051905082811015611806576040805162461bcd60e51b815260206004820152601260248201527f496e73756666696369656e742057455448390000000000000000000000000000604482015290519081900360640190fd5b8015610939577f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316632e1a7d4d826040518263ffffffff1660e01b815260040180828152602001915050600060405180830381600087803b15801561187257600080fd5b505af1158015611886573d6000803e3d6000fd5b505050506109398282613580565b7f000000000000000000000000000000000000000000000000000000000000000081565b6000806118c6600284613af8565b509392505050565b600061148f82604051806060016040528060298152602001615e6e6029913960029190613b16565b606090565b60006001600160a01b0382166119425760405162461bcd60e51b815260040180806020018281038252602a815260200180615e44602a913960400191505060405180910390fd5b6001600160a01b038216600090815260016020526040902061148f90613689565b8361196c613377565b11156119bf576040805162461bcd60e51b815260206004820152600e60248201527f5065726d69742065787069726564000000000000000000000000000000000000604482015290519081900360640190fd5b60006119c96114b9565b7f49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad88886119f581613b23565b604080516020808201969096526001600160a01b03909416848201526060840192909252608083015260a08083018a90528151808403909101815260c0830182528051908401207f190100000000000000000000000000000000000000000000000000000000000060e084015260e283019490945261010280830194909452805180830390940184526101229091019052815191012090506000611a98876118ce565b9050806001600160a01b0316886001600160a01b03161415611aeb5760405162461bcd60e51b8152600401808060200182810382526027815260200180615d6f6027913960400191505060405180910390fd5b611af481613b62565b15611ccf576040805160208082018790528183018690527fff0000000000000000000000000000000000000000000000000000000000000060f889901b16606083015282516041818403018152606183018085527f1626ba7e0000000000000000000000000000000000000000000000000000000090526065830186815260858401948552815160a585015281516001600160a01b03871695631626ba7e958995919260c59091019185019080838360005b83811015611bbe578181015183820152602001611ba6565b50505050905090810190601f168015611beb5780820380516001836020036101000a031916815260200191505b50935050505060206040518083038186803b158015611c0957600080fd5b505afa158015611c1d573d6000803e3d6000fd5b505050506040513d6020811015611c3357600080fd5b50517fffffffff00000000000000000000000000000000000000000000000000000000167f1626ba7e0000000000000000000000000000000000000000000000000000000014611cca576040805162461bcd60e51b815260206004820152600c60248201527f556e617574686f72697a65640000000000000000000000000000000000000000604482015290519081900360640190fd5b611dfb565b600060018387878760405160008152602001604052604051808581526020018460ff1681526020018381526020018281526020019450505050506020604051602081039080840390855afa158015611d2b573d6000803e3d6000fd5b5050604051601f1901519150506001600160a01b038116611d93576040805162461bcd60e51b815260206004820152601160248201527f496e76616c6964207369676e6174757265000000000000000000000000000000604482015290519081900360640190fd5b816001600160a01b0316816001600160a01b031614611df9576040805162461bcd60e51b815260206004820152600c60248201527f556e617574686f72697a65640000000000000000000000000000000000000000604482015290519081900360640190fd5b505b611e058888613257565b5050505050505050565b60008060008084610140013580611e24613377565b1115611e77576040805162461bcd60e51b815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b604080516101408101909152600090611f439080611e9860208b018b6150af565b6001600160a01b03168152602001896020016020810190611eb991906150af565b6001600160a01b03168152602001611ed760608b0160408c0161569e565b62ffffff168152306020820152604001611ef760808b0160608c016153e6565b60020b8152602001611f0f60a08b0160808c016153e6565b60020b81526020018960a0013581526020018960c0013581526020018960e001358152602001896101000135815250613694565b92975090955093509050611fb7611f6261014089016101208a016150af565b600d80547fffffffffffffffffffff000000000000000000000000000000000000000000008116600175ffffffffffffffffffffffffffffffffffffffffffff92831690810190921617909155975087613b68565b6000611fe230611fcd60808b0160608c016153e6565b611fdd60a08c0160808d016153e6565b613477565b9050600080836001600160a01b031663514ea4bf846040518263ffffffff1660e01b81526004016120139190615929565b60a06040518083038186803b15801561202b57600080fd5b505afa15801561203f573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061206391906155ac565b5050925092505060006120dc8560405180606001604052808e600001602081019061208e91906150af565b6001600160a01b031681526020018e60200160208101906120af91906150af565b6001600160a01b031681526020018e60400160208101906120d0919061569e565b62ffffff169052613c96565b905060405180610140016040528060006bffffffffffffffffffffffff16815260200160006001600160a01b031681526020018269ffffffffffffffffffff1681526020018c606001602081019061213491906153e6565b60020b815260200161214c60a08e0160808f016153e6565b60020b81526020018a6001600160801b0316815260200184815260200183815260200160006001600160801b0316815260200160006001600160801b0316815250600c60008c815260200190815260200160002060008201518160000160006101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff160217905550602082015181600001600c6101000a8154816001600160a01b0302191690836001600160a01b0316021790555060408201518160010160006101000a81548169ffffffffffffffffffff021916908369ffffffffffffffffffff160217905550606082015181600101600a6101000a81548162ffffff021916908360020b62ffffff160217905550608082015181600101600d6101000a81548162ffffff021916908360020b62ffffff16021790555060a08201518160010160106101000a8154816001600160801b0302191690836001600160801b0316021790555060c0820151816002015560e082015181600301556101008201518160040160006101000a8154816001600160801b0302191690836001600160801b031602179055506101208201518160040160106101000a8154816001600160801b0302191690836001600160801b03160217905550905050897f3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f8a8a8a60405161235b93929190615afd565b60405180910390a25050505050509193509193565b60078054604080516020601f60026000196101006001881615020190951694909404938401819004810282018101909252828152606093909290918301828280156108025780601f106107d757610100808354040283529160200191610802565b6000818152600c6020908152604080832081516101408101835281546bffffffffffffffffffffffff811682526001600160a01b036c010000000000000000000000009091041693810193909352600181015469ffffffffffffffffffff81169284018390526a01000000000000000000008104600290810b810b810b6060860152600160681b8204810b810b810b60808601526001600160801b03600160801b92839004811660a08701529083015460c0860152600383015460e0860152600490920154808316610100860152041661012083015282918291829182918291829182918291829182918291906124da5760405162461bcd60e51b815260040161083390615a4f565b6000600b6000836040015169ffffffffffffffffffff1669ffffffffffffffffffff1681526020019081526020016000206040518060600160405290816000820160009054906101000a90046001600160a01b03166001600160a01b03166001600160a01b031681526020016001820160009054906101000a90046001600160a01b03166001600160a01b03166001600160a01b031681526020016001820160149054906101000a900462ffffff1662ffffff1662ffffff1681525050905081600001518260200151826000015183602001518460400151866060015187608001518860a001518960c001518a60e001518b61010001518c61012001519d509d509d509d509d509d509d509d509d509d509d509d50505091939597999b5091939597999b565b612608613253565b6001600160a01b0316826001600160a01b0316141561266e576040805162461bcd60e51b815260206004820152601960248201527f4552433732313a20617070726f766520746f2063616c6c657200000000000000604482015290519081900360640190fd5b806005600061267b613253565b6001600160a01b0390811682526020808301939093526040918201600090812091871680825291909352912080547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0016921515929092179091556126dd613253565b6001600160a01b03167f17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c318360405180821515815260200191505060405180910390a35050565b604080517fdd62ed3e0000000000000000000000000000000000000000000000000000000081523360048201523060248201529051600019916001600160a01b0389169163dd62ed3e91604480820192602092909190829003018186803b15801561278d57600080fd5b505afa1580156127a1573d6000803e3d6000fd5b505050506040513d60208110156127b757600080fd5b505110156127cd576127cd868686868686611661565b505050505050565b60608167ffffffffffffffff811180156127ee57600080fd5b5060405190808252806020026020018201604052801561282257816020015b606081526020019060019003908161280d5790505b50905060005b8281101561290e576000803086868581811061284057fe5b90506020028101906128529190615bef565b6040516128609291906157d2565b600060405180830381855af49150503d806000811461289b576040519150601f19603f3d011682016040523d82523d6000602084013e6128a0565b606091505b5091509150816128ec576044815110156128b957600080fd5b600481019050808060200190518101906128d39190615402565b60405162461bcd60e51b81526004016108339190615971565b808484815181106128f957fe5b60209081029190910101525050600101612828565b5092915050565b612926612920613253565b836132db565b6129615760405162461bcd60e51b8152600401808060200182810382526031815260200180615f036031913960400191505060405180910390fd5b61296d84848484613de6565b50505050565b604080517fdd62ed3e000000000000000000000000000000000000000000000000000000008152336004820152306024820152905186916001600160a01b0389169163dd62ed3e91604480820192602092909190829003018186803b1580156129db57600080fd5b505afa1580156129ef573d6000803e3d6000fd5b505050506040513d6020811015612a0557600080fd5b505110156127cd576127cd868686868686612c9d565b7f000000000000000000000000000000000000000000000000000000000000000081565b6060612a4a82613246565b612a5357600080fd5b6040517fe9dc63750000000000000000000000000000000000000000000000000000000081526001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000169063e9dc637590612aba9030908690600401615932565b60006040518083038186803b158015612ad257600080fd5b505afa158015612ae6573d6000803e3d6000fd5b505050506040513d6000823e601f3d908101601f1916820160405261148f9190810190615402565b6000612b1c828401846154a5565b9050612b4c7f00000000000000000000000000000000000000000000000000000000000000008260000151613e38565b508415612b67578051516020820151612b6791903388613e5b565b8315612b8557612b8581600001516020015182602001513387613e5b565b5050505050565b6000836001600160a01b03166370a08231306040518263ffffffff1660e01b815260040180826001600160a01b0316815260200191505060206040518083038186803b158015612bdb57600080fd5b505afa158015612bef573d6000803e3d6000fd5b505050506040513d6020811015612c0557600080fd5b5051905082811015612c5e576040805162461bcd60e51b815260206004820152601260248201527f496e73756666696369656e7420746f6b656e0000000000000000000000000000604482015290519081900360640190fd5b801561296d5761296d848383613feb565b6001600160a01b03918216600090815260056020908152604080832093909416825291909152205460ff1690565b604080517fd505accf000000000000000000000000000000000000000000000000000000008152336004820152306024820152604481018790526064810186905260ff8516608482015260a4810184905260c4810183905290516001600160a01b0388169163d505accf9160e480830192600092919082900301818387803b1580156116f457600080fd5b6000808235612d3733826132db565b612d535760405162461bcd60e51b815260040161083390615984565b6000612d656060860160408701615562565b6001600160801b03161180612d9257506000612d876080860160608701615562565b6001600160801b0316115b612d9b57600080fd5b600080612dae60408701602088016150af565b6001600160a01b031614612dd157612dcc60408601602087016150af565b612dd3565b305b85356000908152600c6020908152604080832060018082015469ffffffffffffffffffff168552600b8452828520835160608101855281546001600160a01b039081168252919092015490811694820194909452600160a01b90930462ffffff169183019190915292935090612e697f00000000000000000000000000000000000000000000000000000000000000008361337b565b600484015460018501549192506001600160801b0380821692600160801b92839004821692900416156130865760018501546040517fa34123a70000000000000000000000000000000000000000000000000000000081526001600160a01b0385169163a34123a791612f00916a01000000000000000000008104600290810b92600160681b909204900b9060009060040161594b565b6040805180830381600087803b158015612f1957600080fd5b505af1158015612f2d573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190612f5191906156f4565b5050600185015460009081906001600160a01b0386169063514ea4bf90612f969030906a01000000000000000000008104600290810b91600160681b9004900b613477565b6040518263ffffffff1660e01b8152600401612fb29190615929565b60a06040518083038186803b158015612fca57600080fd5b505afa158015612fde573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061300291906155ac565b5050925092505061303e876002015483038860010160109054906101000a90046001600160801b03166001600160801b0316600160801b6134d1565b84019350613077876003015482038860010160109054906101000a90046001600160801b03166001600160801b0316600160801b6134d1565b60028801929092556003870155015b6000806001600160801b0384166130a360608e0160408f01615562565b6001600160801b0316116130c6576130c160608d0160408e01615562565b6130c8565b835b836001600160801b03168d60600160208101906130e59190615562565b6001600160801b0316116131085761310360808e0160608f01615562565b61310a565b835b60018901546040517f4f1eb3d80000000000000000000000000000000000000000000000000000000081529294509092506001600160a01b03871691634f1eb3d89161317d918c916a01000000000000000000008104600290810b92600160681b909204900b9088908890600401615839565b6040805180830381600087803b15801561319657600080fd5b505af11580156131aa573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906131ce919061557e565b6004890180546fffffffffffffffffffffffffffffffff196001600160801b03918216600160801b878a0384160217168689038216179091556040519281169d50169a508c35907f40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f0190610d94908b9086908690615876565b600061148f60028361417b565b3390565b6000818152600c6020526040902080546bffffffffffffffffffffffff166c010000000000000000000000006001600160a01b0385169081029190911790915581906132a2826118ce565b6001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560405160405180910390a45050565b60006132e682613246565b6133215760405162461bcd60e51b815260040180806020018281038252602c815260200180615de0602c913960400191505060405180910390fd5b600061332c836118ce565b9050806001600160a01b0316846001600160a01b031614806133675750836001600160a01b031661335c8461080c565b6001600160a01b0316145b806110c157506110c18185612c6f565b4290565b600081602001516001600160a01b031682600001516001600160a01b0316106133a357600080fd5b50805160208083015160409384015184516001600160a01b0394851681850152939091168385015262ffffff166060808401919091528351808403820181526080840185528051908301207fff0000000000000000000000000000000000000000000000000000000000000060a085015294901b6bffffffffffffffffffffffff191660a183015260b58201939093527fe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b5460d5808301919091528251808303909101815260f5909101909152805191012090565b604080516bffffffffffffffffffffffff19606086901b16602080830191909152600285810b60e890811b60348501529085900b901b60378301528251601a818403018152603a90920190925280519101205b9392505050565b600080806000198587098686029250828110908390030390508061350757600084116134fc57600080fd5b5082900490506134ca565b80841161351357600080fd5b6000848688096000868103871696879004966002600389028118808a02820302808a02820302808a02820302808a02820302808a02820302808a02909103029181900381900460010186841190950394909402919094039290920491909117919091029150509392505050565b604080516000808252602082019092526001600160a01b0384169083906040518082805190602001908083835b602083106135cc5780518252601f1990920191602091820191016135ad565b6001836020036101000a03801982511681845116808217855250505050505090500191505060006040518083038185875af1925050503d806000811461362e576040519150601f19603f3d011682016040523d82523d6000602084013e613633565b606091505b5050905080610939576040805162461bcd60e51b815260206004820152600360248201527f5354450000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b600061148f82614187565b6000806000806000604051806060016040528087600001516001600160a01b0316815260200187602001516001600160a01b03168152602001876040015162ffffff1681525090506137067f00000000000000000000000000000000000000000000000000000000000000008261337b565b91506000826001600160a01b0316633850c7bd6040518163ffffffff1660e01b815260040160e06040518083038186803b15801561374357600080fd5b505afa158015613757573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061377b919061560d565b50505050505090506000613792886080015161418b565b905060006137a38960a0015161418b565b90506137ba8383838c60c001518d60e001516144d9565b9750505050816001600160a01b0316633c8a7d8d876060015188608001518960a00151896040518060400160405280888152602001336001600160a01b031681525060405160200161380c9190615abd565b6040516020818303038152906040526040518663ffffffff1660e01b815260040161383b9594939291906157f6565b6040805180830381600087803b15801561385457600080fd5b505af1158015613868573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061388c91906156f4565b610100880151919550935084108015906138ab57508561012001518310155b6138c75760405162461bcd60e51b815260040161083390615a18565b509193509193565b826001600160a01b03166138e2826118ce565b6001600160a01b0316146139275760405162461bcd60e51b8152600401808060200182810382526029815260200180615eb96029913960400191505060405180910390fd5b6001600160a01b03821661396c5760405162461bcd60e51b8152600401808060200182810382526024815260200180615d966024913960400191505060405180910390fd5b613977838383610939565b613982600082613257565b6001600160a01b03831660009081526001602052604090206139a4908261459d565b506001600160a01b03821660009081526001602052604090206139c790826145a9565b506139d4600282846145b5565b5080826001600160a01b0316846001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef60405160405180910390a4505050565b600061148c83836145cb565b4690565b6000613a36826118ce565b9050613a4481600084610939565b613a4f600083613257565b6000828152600860205260409020546002600019610100600184161502019091160415613a8d576000828152600860205260408120613a8d9161501f565b6001600160a01b0381166000908152600160205260409020613aaf908361459d565b50613abb60028361462f565b5060405182906000906001600160a01b038416907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908390a45050565b6000808080613b07868661463b565b909450925050505b9250929050565b60006110c18484846146b6565b6000908152600c6020526040902080546bffffffffffffffffffffffff19811660016bffffffffffffffffffffffff9283169081019092161790915590565b3b151590565b6001600160a01b038216613bc3576040805162461bcd60e51b815260206004820181905260248201527f4552433732313a206d696e7420746f20746865207a65726f2061646472657373604482015290519081900360640190fd5b613bcc81613246565b15613c1e576040805162461bcd60e51b815260206004820152601c60248201527f4552433732313a20746f6b656e20616c7265616479206d696e74656400000000604482015290519081900360640190fd5b613c2a60008383610939565b6001600160a01b0382166000908152600160205260409020613c4c90826145a9565b50613c59600282846145b5565b5060405181906001600160a01b038416906000907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908290a45050565b6001600160a01b0382166000908152600a602052604090205469ffffffffffffffffffff168061148f5750600d8054600169ffffffffffffffffffff76010000000000000000000000000000000000000000000080840482168381019092160275ffffffffffffffffffffffffffffffffffffffffffff909316929092179092556001600160a01b038085166000908152600a6020908152604080832080547fffffffffffffffffffffffffffffffffffffffffffff000000000000000000001686179055848352600b825291829020865181549085167fffffffffffffffffffffffff000000000000000000000000000000000000000091821617825591870151950180549287015162ffffff16600160a01b027fffffffffffffffffff000000ffffffffffffffffffffffffffffffffffffffff969094169290911691909117939093161790915592915050565b613df18484846138cf565b613dfd84848484614780565b61296d5760405162461bcd60e51b8152600401808060200182810382526032815260200180615d3d6032913960400191505060405180910390fd5b6000613e44838361337b565b9050336001600160a01b0382161461148f57600080fd5b7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316846001600160a01b0316148015613e9c5750804710155b15613fbe577f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031663d0e30db0826040518263ffffffff1660e01b81526004016000604051808303818588803b158015613efc57600080fd5b505af1158015613f10573d6000803e3d6000fd5b50505050507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031663a9059cbb83836040518363ffffffff1660e01b815260040180836001600160a01b0316815260200182815260200192505050602060405180830381600087803b158015613f8c57600080fd5b505af1158015613fa0573d6000803e3d6000fd5b505050506040513d6020811015613fb657600080fd5b5061296d9050565b6001600160a01b038316301415613fdf57613fda848383613feb565b61296d565b61296d8484848461495c565b604080516001600160a01b038481166024830152604480830185905283518084039091018152606490920183526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167fa9059cbb000000000000000000000000000000000000000000000000000000001781529251825160009485949389169392918291908083835b602083106140955780518252601f199092019160209182019101614076565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d80600081146140f7576040519150601f19603f3d011682016040523d82523d6000602084013e6140fc565b606091505b509150915081801561412a57508051158061412a575080806020019051602081101561412757600080fd5b50515b612b85576040805162461bcd60e51b815260206004820152600260248201527f5354000000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b600061148c8383614af4565b5490565b60008060008360020b126141a2578260020b6141aa565b8260020b6000035b9050620d89e8811115614204576040805162461bcd60e51b815260206004820152600160248201527f5400000000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b60006001821661421857600160801b61422a565b6ffffcb933bd6fad37aa2d162d1a5940015b70ffffffffffffffffffffffffffffffffff169050600282161561425e576ffff97272373d413259a46990580e213a0260801c5b600482161561427d576ffff2e50f5f656932ef12357cf3c7fdcc0260801c5b600882161561429c576fffe5caca7e10e4e61c3624eaa0941cd00260801c5b60108216156142bb576fffcb9843d60f6159c9db58835c9266440260801c5b60208216156142da576fff973b41fa98c081472e6896dfb254c00260801c5b60408216156142f9576fff2ea16466c96a3843ec78b326b528610260801c5b6080821615614318576ffe5dee046a99a2a811c461f1969c30530260801c5b610100821615614338576ffcbe86c7900a88aedcffc83b479aa3a40260801c5b610200821615614358576ff987a7253ac413176f2b074cf7815e540260801c5b610400821615614378576ff3392b0822b70005940c7a398e4b70f30260801c5b610800821615614398576fe7159475a2c29b7443b29c7fa6e889d90260801c5b6110008216156143b8576fd097f3bdfd2022b8845ad8f792aa58250260801c5b6120008216156143d8576fa9f746462d870fdf8a65dc1f90e061e50260801c5b6140008216156143f8576f70d869a156d2a1b890bb3df62baf32f70260801c5b618000821615614418576f31be135f97d08fd981231505542fcfa60260801c5b62010000821615614439576f09aa508b5b7a84e1c677de54f3e99bc90260801c5b62020000821615614459576e5d6af8dedb81196699c329225ee6040260801c5b62040000821615614478576d2216e584f5fa1ea926041bedfe980260801c5b62080000821615614495576b048a170391f7dc42444e8fa20260801c5b60008460020b13156144b05780600019816144ac57fe5b0490505b6401000000008106156144c45760016144c7565b60005b60ff16602082901c0192505050919050565b6000836001600160a01b0316856001600160a01b031611156144f9579293925b846001600160a01b0316866001600160a01b0316116145245761451d858585614b0c565b9050614594565b836001600160a01b0316866001600160a01b0316101561458657600061454b878686614b0c565b9050600061455a878986614b78565b9050806001600160801b0316826001600160801b03161061457b578061457d565b815b92505050614594565b614591858584614b78565b90505b95945050505050565b600061148c8383614bbe565b600061148c8383614c84565b60006110c184846001600160a01b038516614cce565b8154600090821061460d5760405162461bcd60e51b8152600401808060200182810382526022815260200180615d1b6022913960400191505060405180910390fd5b82600001828154811061461c57fe5b9060005260206000200154905092915050565b600061148c8383614d65565b81546000908190831061467f5760405162461bcd60e51b8152600401808060200182810382526022815260200180615e976022913960400191505060405180910390fd5b600084600001848154811061469057fe5b906000526020600020906002020190508060000154816001015492509250509250929050565b600082815260018401602052604081205482816147515760405162461bcd60e51b81526004018080602001828103825283818151815260200191508051906020019080838360005b838110156147165781810151838201526020016146fe565b50505050905090810190601f1680156147435780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b5084600001600182038154811061476457fe5b9060005260206000209060020201600101549150509392505050565b6000614794846001600160a01b0316613b62565b6147a0575060016110c1565b60006148f17f150b7a02000000000000000000000000000000000000000000000000000000006147ce613253565b88878760405160240180856001600160a01b03168152602001846001600160a01b0316815260200183815260200180602001828103825283818151815260200191508051906020019080838360005b8381101561483557818101518382015260200161481d565b50505050905090810190601f1680156148625780820380516001836020036101000a031916815260200191505b5095505050505050604051602081830303815290604052907bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19166020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff8381831617835250505050604051806060016040528060328152602001615d3d603291396001600160a01b0388169190614e39565b9050600081806020019051602081101561490a57600080fd5b50517fffffffff00000000000000000000000000000000000000000000000000000000167f150b7a02000000000000000000000000000000000000000000000000000000001492505050949350505050565b604080516001600160a01b0385811660248301528481166044830152606480830185905283518084039091018152608490920183526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167f23b872dd00000000000000000000000000000000000000000000000000000000178152925182516000948594938a169392918291908083835b60208310614a0e5780518252601f1990920191602091820191016149ef565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d8060008114614a70576040519150601f19603f3d011682016040523d82523d6000602084013e614a75565b606091505b5091509150818015614aa3575080511580614aa35750808060200190516020811015614aa057600080fd5b50515b6127cd576040805162461bcd60e51b815260206004820152600360248201527f5354460000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b60009081526001919091016020526040902054151590565b6000826001600160a01b0316846001600160a01b03161115614b2c579192915b6000614b58856001600160a01b0316856001600160a01b03166c010000000000000000000000006134d1565b9050614594614b7384838888036001600160a01b03166134d1565b614e48565b6000826001600160a01b0316846001600160a01b03161115614b98579192915b6110c1614b73836c010000000000000000000000008787036001600160a01b03166134d1565b60008181526001830160205260408120548015614c7a5783546000198083019190810190600090879083908110614bf157fe5b9060005260206000200154905080876000018481548110614c0e57fe5b600091825260208083209091019290925582815260018981019092526040902090840190558654879080614c3e57fe5b6001900381819060005260206000200160009055905586600101600087815260200190815260200160002060009055600194505050505061148f565b600091505061148f565b6000614c908383614af4565b614cc65750815460018181018455600084815260208082209093018490558454848252828601909352604090209190915561148f565b50600061148f565b600082815260018401602052604081205480614d335750506040805180820182528381526020808201848152865460018181018955600089815284812095516002909302909501918255915190820155865486845281880190925292909120556134ca565b82856000016001830381548110614d4657fe5b90600052602060002090600202016001018190555060009150506134ca565b60008181526001830160205260408120548015614c7a5783546000198083019190810190600090879083908110614d9857fe5b9060005260206000209060020201905080876000018481548110614db857fe5b600091825260208083208454600290930201918255600193840154918401919091558354825289830190526040902090840190558654879080614df757fe5b600082815260208082206002600019909401938402018281556001908101839055929093558881528982019092526040822091909155945061148f9350505050565b60606110c18484600085614e5e565b806001600160801b038116811461077157600080fd5b606082471015614e9f5760405162461bcd60e51b8152600401808060200182810382526026815260200180615dba6026913960400191505060405180910390fd5b614ea885613b62565b614ef9576040805162461bcd60e51b815260206004820152601d60248201527f416464726573733a2063616c6c20746f206e6f6e2d636f6e7472616374000000604482015290519081900360640190fd5b600080866001600160a01b031685876040518082805190602001908083835b60208310614f375780518252601f199092019160209182019101614f18565b6001836020036101000a03801982511681845116808217855250505050505090500191505060006040518083038185875af1925050503d8060008114614f99576040519150601f19603f3d011682016040523d82523d6000602084013e614f9e565b606091505b5091509150614fae828286614fb9565b979650505050505050565b60608315614fc85750816134ca565b825115614fd85782518084602001fd5b60405162461bcd60e51b81526020600482018181528451602484015284518593919283926044019190850190808383600083156147165781810151838201526020016146fe565b50805460018160011615610100020316600290046000825580601f106150455750615063565b601f0160209004906000526020600020908101906150639190615066565b50565b5b8082111561507b5760008155600101615067565b5090565b803561077181615cc4565b805161ffff8116811461077157600080fd5b803562ffffff8116811461077157600080fd5b6000602082840312156150c0578081fd5b81356134ca81615cc4565b600080604083850312156150dd578081fd5b82356150e881615cc4565b915060208301356150f881615cc4565b809150509250929050565b60008060008060808587031215615118578182fd5b843561512381615cc4565b9350602085013561513381615cc4565b92506151416040860161509c565b9150606085013561515181615cc4565b939692955090935050565b600080600060608486031215615170578081fd5b833561517b81615cc4565b9250602084013561518b81615cc4565b929592945050506040919091013590565b600080600080608085870312156151b1578182fd5b84356151bc81615cc4565b935060208501356151cc81615cc4565b925060408501359150606085013567ffffffffffffffff8111156151ee578182fd5b8501601f810187136151fe578182fd5b803561521161520c82615c76565b615c52565b818152886020838501011115615225578384fd5b81602084016020830137908101602001929092525092959194509250565b60008060408385031215615255578182fd5b823561526081615cc4565b915060208301356150f881615cd9565b60008060408385031215615282578182fd5b823561528d81615cc4565b946020939093013593505050565b6000806000606084860312156152af578081fd5b83356152ba81615cc4565b92506020840135915060408401356152d181615cc4565b809150509250925092565b60008060008060008060c087890312156152f4578384fd5b86356152ff81615cc4565b95506020870135945060408701359350606087013561531d81615d0b565b9598949750929560808101359460a0909101359350915050565b60008060208385031215615349578182fd5b823567ffffffffffffffff80821115615360578384fd5b818501915085601f830112615373578384fd5b813581811115615381578485fd5b8660208083028501011115615394578485fd5b60209290920196919550909350505050565b6000602082840312156153b7578081fd5b81357fffffffff00000000000000000000000000000000000000000000000000000000811681146134ca578182fd5b6000602082840312156153f7578081fd5b81356134ca81615ce7565b600060208284031215615413578081fd5b815167ffffffffffffffff811115615429578182fd5b8201601f81018413615439578182fd5b805161544761520c82615c76565b81815285602083850101111561545b578384fd5b614594826020830160208601615c98565b60006080828403121561547d578081fd5b50919050565b600060a0828403121561547d578081fd5b600060c0828403121561547d578081fd5b600081830360808112156154b7578182fd5b6040516040810167ffffffffffffffff82821081831117156154d557fe5b8160405260608412156154e6578485fd5b60a08301935081841081851117156154fa57fe5b50826040528435925061550c83615cc4565b91825260208401359161551e83615cc4565b8260608301526155306040860161509c565b608083015281526155436060850161507f565b6020820152949350505050565b6000610160828403121561547d578081fd5b600060208284031215615573578081fd5b81356134ca81615cf6565b60008060408385031215615590578182fd5b825161559b81615cf6565b60208401519092506150f881615cf6565b600080600080600060a086880312156155c3578283fd5b85516155ce81615cf6565b80955050602086015193506040860151925060608601516155ee81615cf6565b60808701519092506155ff81615cf6565b809150509295509295909350565b600080600080600080600060e0888a031215615627578485fd5b875161563281615cc4565b602089015190975061564381615ce7565b95506156516040890161508a565b945061565f6060890161508a565b935061566d6080890161508a565b925060a088015161567d81615d0b565b60c089015190925061568e81615cd9565b8091505092959891949750929550565b6000602082840312156156af578081fd5b61148c8261509c565b6000602082840312156156c9578081fd5b5035919050565b600080604083850312156156e2578182fd5b8235915060208301356150f881615cc4565b60008060408385031215615706578182fd5b505080516020909101519092909150565b6000806000806060858703121561572c578182fd5b8435935060208501359250604085013567ffffffffffffffff80821115615751578384fd5b818701915087601f830112615764578384fd5b813581811115615772578485fd5b886020828501011115615783578485fd5b95989497505060200194505050565b600081518084526157aa816020860160208601615c98565b601f01601f19169290920160200192915050565b60020b9052565b6001600160801b03169052565b6000828483379101908152919050565b6001600160a01b0391909116815260200190565b60006001600160a01b03871682528560020b60208301528460020b60408301526001600160801b038416606083015260a06080830152614fae60a0830184615792565b6001600160a01b03959095168552600293840b60208601529190920b60408401526001600160801b03918216606084015216608082015260a00190565b6001600160a01b039390931683526001600160801b03918216602084015216604082015260600190565b6000602080830181845280855180835260408601915060408482028701019250838701855b82811015615911577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc08886030184526158ff858351615792565b945092850192908501906001016158c5565b5092979650505050505050565b901515815260200190565b90815260200190565b6001600160a01b03929092168252602082015260400190565b600293840b81529190920b60208201526001600160801b03909116604082015260600190565b60006020825261148c6020830184615792565b6020808252600c908201527f4e6f7420617070726f7665640000000000000000000000000000000000000000604082015260600190565b6020808252602c908201527f4552433732313a20617070726f76656420717565727920666f72206e6f6e657860408201527f697374656e7420746f6b656e0000000000000000000000000000000000000000606082015260800190565b60208082526014908201527f507269636520736c69707061676520636865636b000000000000000000000000604082015260600190565b60208082526010908201527f496e76616c696420746f6b656e20494400000000000000000000000000000000604082015260600190565b6020808252600b908201527f4e6f7420636c6561726564000000000000000000000000000000000000000000604082015260600190565b815180516001600160a01b03908116835260208083015182168185015260409283015162ffffff1692840192909252920151909116606082015260800190565b6001600160801b039390931683526020830191909152604082015260600190565b9384526001600160801b039290921660208401526040830152606082015260800190565b918252602082015260400190565b6bffffffffffffffffffffffff8d1681526001600160a01b038c811660208301528b811660408301528a16606082015262ffffff89166080820152600288900b60a08201526101808101615ba760c08301896157be565b615bb460e08301886157c5565b8561010083015284610120830152615bd06101408301856157c5565b615bde6101608301846157c5565b9d9c50505050505050505050505050565b60008083357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe1843603018112615c23578283fd5b83018035915067ffffffffffffffff821115615c3d578283fd5b602001915036819003821315613b0f57600080fd5b60405181810167ffffffffffffffff81118282101715615c6e57fe5b604052919050565b600067ffffffffffffffff821115615c8a57fe5b50601f01601f191660200190565b60005b83811015615cb3578181015183820152602001615c9b565b8381111561296d5750506000910152565b6001600160a01b038116811461506357600080fd5b801515811461506357600080fd5b8060020b811461506357600080fd5b6001600160801b038116811461506357600080fd5b60ff8116811461506357600080fdfe456e756d657261626c655365743a20696e646578206f7574206f6620626f756e64734552433732313a207472616e7366657220746f206e6f6e20455243373231526563656976657220696d706c656d656e7465724552433732315065726d69743a20617070726f76616c20746f2063757272656e74206f776e65724552433732313a207472616e7366657220746f20746865207a65726f2061646472657373416464726573733a20696e73756666696369656e742062616c616e636520666f722063616c6c4552433732313a206f70657261746f7220717565727920666f72206e6f6e6578697374656e7420746f6b656e4552433732313a20617070726f76652063616c6c6572206973206e6f74206f776e6572206e6f7220617070726f76656420666f7220616c6c4552433732313a2062616c616e636520717565727920666f7220746865207a65726f20616464726573734552433732313a206f776e657220717565727920666f72206e6f6e6578697374656e7420746f6b656e456e756d657261626c654d61703a20696e646578206f7574206f6620626f756e64734552433732313a207472616e73666572206f6620746f6b656e2074686174206973206e6f74206f776e4552433732313a20617070726f76616c20746f2063757272656e74206f776e65724552433732313a207472616e736665722063616c6c6572206973206e6f74206f776e6572206e6f7220617070726f766564a164736f6c6343000706000a",
  linkReferences: {},
  deployedLinkReferences: {}
};

// ../../node_modules/@uniswap/v3-periphery/artifacts/contracts/interfaces/ISelfPermit.sol/ISelfPermit.json
var ISelfPermit_default = {
  _format: "hh-sol-artifact-1",
  contractName: "ISelfPermit",
  sourceName: "contracts/interfaces/ISelfPermit.sol",
  abi: [
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "deadline",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "selfPermit",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "nonce",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "expiry",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "selfPermitAllowed",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "nonce",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "expiry",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "selfPermitAllowedIfNecessary",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "deadline",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "selfPermitIfNecessary",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    }
  ],
  bytecode: "0x",
  deployedBytecode: "0x",
  linkReferences: {},
  deployedLinkReferences: {}
};

// ../../node_modules/@uniswap/v3-periphery/artifacts/contracts/interfaces/IPeripheryPaymentsWithFee.sol/IPeripheryPaymentsWithFee.json
var IPeripheryPaymentsWithFee_default = {
  _format: "hh-sol-artifact-1",
  contractName: "IPeripheryPaymentsWithFee",
  sourceName: "contracts/interfaces/IPeripheryPaymentsWithFee.sol",
  abi: [
    {
      inputs: [],
      name: "refundETH",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "amountMinimum",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "recipient",
          type: "address"
        }
      ],
      name: "sweepToken",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "amountMinimum",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "recipient",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "feeBips",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "feeRecipient",
          type: "address"
        }
      ],
      name: "sweepTokenWithFee",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "amountMinimum",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "recipient",
          type: "address"
        }
      ],
      name: "unwrapWETH9",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "amountMinimum",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "recipient",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "feeBips",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "feeRecipient",
          type: "address"
        }
      ],
      name: "unwrapWETH9WithFee",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    }
  ],
  bytecode: "0x",
  deployedBytecode: "0x",
  linkReferences: {},
  deployedLinkReferences: {}
};

// ../../node_modules/@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json
var Quoter_default = {
  _format: "hh-sol-artifact-1",
  contractName: "Quoter",
  sourceName: "contracts/lens/Quoter.sol",
  abi: [
    {
      inputs: [
        {
          internalType: "address",
          name: "_factory",
          type: "address"
        },
        {
          internalType: "address",
          name: "_WETH9",
          type: "address"
        }
      ],
      stateMutability: "nonpayable",
      type: "constructor"
    },
    {
      inputs: [],
      name: "WETH9",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "factory",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "bytes",
          name: "path",
          type: "bytes"
        },
        {
          internalType: "uint256",
          name: "amountIn",
          type: "uint256"
        }
      ],
      name: "quoteExactInput",
      outputs: [
        {
          internalType: "uint256",
          name: "amountOut",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "tokenIn",
          type: "address"
        },
        {
          internalType: "address",
          name: "tokenOut",
          type: "address"
        },
        {
          internalType: "uint24",
          name: "fee",
          type: "uint24"
        },
        {
          internalType: "uint256",
          name: "amountIn",
          type: "uint256"
        },
        {
          internalType: "uint160",
          name: "sqrtPriceLimitX96",
          type: "uint160"
        }
      ],
      name: "quoteExactInputSingle",
      outputs: [
        {
          internalType: "uint256",
          name: "amountOut",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "bytes",
          name: "path",
          type: "bytes"
        },
        {
          internalType: "uint256",
          name: "amountOut",
          type: "uint256"
        }
      ],
      name: "quoteExactOutput",
      outputs: [
        {
          internalType: "uint256",
          name: "amountIn",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "tokenIn",
          type: "address"
        },
        {
          internalType: "address",
          name: "tokenOut",
          type: "address"
        },
        {
          internalType: "uint24",
          name: "fee",
          type: "uint24"
        },
        {
          internalType: "uint256",
          name: "amountOut",
          type: "uint256"
        },
        {
          internalType: "uint160",
          name: "sqrtPriceLimitX96",
          type: "uint160"
        }
      ],
      name: "quoteExactOutputSingle",
      outputs: [
        {
          internalType: "uint256",
          name: "amountIn",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "int256",
          name: "amount0Delta",
          type: "int256"
        },
        {
          internalType: "int256",
          name: "amount1Delta",
          type: "int256"
        },
        {
          internalType: "bytes",
          name: "path",
          type: "bytes"
        }
      ],
      name: "uniswapV3SwapCallback",
      outputs: [],
      stateMutability: "view",
      type: "function"
    }
  ],
  bytecode: "0x60c060405234801561001057600080fd5b506040516112e53803806112e583398101604081905261002f91610069565b6001600160601b0319606092831b8116608052911b1660a05261009b565b80516001600160a01b038116811461006457600080fd5b919050565b6000806040838503121561007b578182fd5b6100848361004d565b91506100926020840161004d565b90509250929050565b60805160601c60a05160601c6112176100ce60003980610342525080610366528061058652806106d552506112176000f3fe608060405234801561001057600080fd5b506004361061007d5760003560e01c8063c45a01551161005b578063c45a0155146100d3578063cdca1753146100db578063f7729d43146100ee578063fa461e33146101015761007d565b80632f80bb1d1461008257806330d07f21146100ab5780634aa4a4fc146100be575b600080fd5b610095610090366004610e9e565b610116565b6040516100a29190611148565b60405180910390f35b6100956100b9366004610e30565b61017b565b6100c6610340565b6040516100a29190611084565b6100c6610364565b6100956100e9366004610e9e565b610388565b6100956100fc366004610e30565b6103d6565b61011461010f366004610f04565b610555565b005b60005b600061012484610660565b9050600080600061013487610668565b92509250925061014882848389600061017b565b955083156101605761015987610699565b965061016c565b85945050505050610175565b50505050610119565b92915050565b600073ffffffffffffffffffffffffffffffffffffffff808616878216109083166101a65760008490555b6101b18787876106ce565b73ffffffffffffffffffffffffffffffffffffffff1663128acb0830836101d78861070c565b60000373ffffffffffffffffffffffffffffffffffffffff8816156101fc5787610222565b8561021b5773fffd8963efd1fc6a506488495d951d5263988d25610222565b6401000276a45b8b8b8e6040516020016102379392919061101e565b6040516020818303038152906040526040518663ffffffff1660e01b81526004016102669594939291906110a5565b6040805180830381600087803b15801561027f57600080fd5b505af19250505080156102cd575060408051601f3d9081017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01682019092526102ca91810190610ee1565b60015b610333573d8080156102fb576040519150601f19603f3d011682016040523d82523d6000602084013e610300565b606091505b5073ffffffffffffffffffffffffffffffffffffffff841661032157600080555b61032a8161073e565b92505050610337565b5050505b95945050505050565b7f000000000000000000000000000000000000000000000000000000000000000081565b7f000000000000000000000000000000000000000000000000000000000000000081565b60005b600061039684610660565b905060008060006103a687610668565b9250925092506103ba8383838960006103d6565b95508315610160576103cb87610699565b96505050505061038b565b600073ffffffffffffffffffffffffffffffffffffffff808616908716106103ff8787876106ce565b73ffffffffffffffffffffffffffffffffffffffff1663128acb0830836104258861070c565b73ffffffffffffffffffffffffffffffffffffffff881615610447578761046d565b856104665773fffd8963efd1fc6a506488495d951d5263988d2561046d565b6401000276a45b8c8b8d6040516020016104829392919061101e565b6040516020818303038152906040526040518663ffffffff1660e01b81526004016104b19594939291906110a5565b6040805180830381600087803b1580156104ca57600080fd5b505af1925050508015610518575060408051601f3d9081017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe016820190925261051591810190610ee1565b60015b610333573d808015610546576040519150601f19603f3d011682016040523d82523d6000602084013e61054b565b606091505b5061032a8161073e565b60008313806105645750600082135b61056d57600080fd5b600080600061057b84610668565b9250925092506105ad7f00000000000000000000000000000000000000000000000000000000000000008484846107ef565b5060008060008089136105f3578573ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff1610888a600003610628565b8473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff161089896000035b925092509250821561063f57604051818152602081fd5b6000541561065557600054811461065557600080fd5b604051828152602081fd5b516042111590565b600080806106768482610805565b9250610683846014610905565b9050610690846017610805565b91509193909250565b80516060906101759083906017907fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe9016109f5565b60006107047f00000000000000000000000000000000000000000000000000000000000000006106ff868686610bdc565b610c59565b949350505050565b60007f8000000000000000000000000000000000000000000000000000000000000000821061073a57600080fd5b5090565b600081516020146107db5760448251101561078e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161078590611111565b60405180910390fd5b600482019150818060200190518101906107a89190610f52565b6040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161078591906110f7565b818060200190518101906101759190610fbc565b600061033785610800868686610bdc565b610d8f565b60008182601401101561087957604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f746f416464726573735f6f766572666c6f770000000000000000000000000000604482015290519081900360640190fd5b81601401835110156108ec57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601560248201527f746f416464726573735f6f75744f66426f756e64730000000000000000000000604482015290519081900360640190fd5b5001602001516c01000000000000000000000000900490565b60008182600301101561097957604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601160248201527f746f55696e7432345f6f766572666c6f77000000000000000000000000000000604482015290519081900360640190fd5b81600301835110156109ec57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601460248201527f746f55696e7432345f6f75744f66426f756e6473000000000000000000000000604482015290519081900360640190fd5b50016003015190565b60608182601f011015610a6957604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600e60248201527f736c6963655f6f766572666c6f77000000000000000000000000000000000000604482015290519081900360640190fd5b828284011015610ada57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600e60248201527f736c6963655f6f766572666c6f77000000000000000000000000000000000000604482015290519081900360640190fd5b81830184511015610b4c57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601160248201527f736c6963655f6f75744f66426f756e6473000000000000000000000000000000604482015290519081900360640190fd5b606082158015610b6b5760405191506000825260208201604052610bd3565b6040519150601f8416801560200281840101858101878315602002848b0101015b81831015610ba4578051835260209283019201610b8c565b5050858452601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe016604052505b50949350505050565b610be4610dbf565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff161115610c1c579192915b506040805160608101825273ffffffffffffffffffffffffffffffffffffffff948516815292909316602083015262ffffff169181019190915290565b6000816020015173ffffffffffffffffffffffffffffffffffffffff16826000015173ffffffffffffffffffffffffffffffffffffffff1610610c9b57600080fd5b508051602080830151604093840151845173ffffffffffffffffffffffffffffffffffffffff94851681850152939091168385015262ffffff166060808401919091528351808403820181526080840185528051908301207fff0000000000000000000000000000000000000000000000000000000000000060a085015294901b7fffffffffffffffffffffffffffffffffffffffff0000000000000000000000001660a183015260b58201939093527fe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b5460d5808301919091528251808303909101815260f5909101909152805191012090565b6000610d9b8383610c59565b90503373ffffffffffffffffffffffffffffffffffffffff82161461017557600080fd5b604080516060810182526000808252602082018190529181019190915290565b600082601f830112610def578081fd5b8135610e02610dfd82611175565b611151565b818152846020838601011115610e16578283fd5b816020850160208301379081016020019190915292915050565b600080600080600060a08688031215610e47578081fd5b8535610e52816111e5565b94506020860135610e62816111e5565b9350604086013562ffffff81168114610e79578182fd5b9250606086013591506080860135610e90816111e5565b809150509295509295909350565b60008060408385031215610eb0578182fd5b823567ffffffffffffffff811115610ec6578283fd5b610ed285828601610ddf565b95602094909401359450505050565b60008060408385031215610ef3578182fd5b505080516020909101519092909150565b600080600060608486031215610f18578283fd5b8335925060208401359150604084013567ffffffffffffffff811115610f3c578182fd5b610f4886828701610ddf565b9150509250925092565b600060208284031215610f63578081fd5b815167ffffffffffffffff811115610f79578182fd5b8201601f81018413610f89578182fd5b8051610f97610dfd82611175565b818152856020838501011115610fab578384fd5b6103378260208301602086016111b5565b600060208284031215610fcd578081fd5b5051919050565b60008151808452610fec8160208601602086016111b5565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b606093841b7fffffffffffffffffffffffffffffffffffffffff000000000000000000000000908116825260e89390931b7fffffff0000000000000000000000000000000000000000000000000000000000166014820152921b166017820152602b0190565b73ffffffffffffffffffffffffffffffffffffffff91909116815260200190565b600073ffffffffffffffffffffffffffffffffffffffff8088168352861515602084015285604084015280851660608401525060a060808301526110ec60a0830184610fd4565b979650505050505050565b60006020825261110a6020830184610fd4565b9392505050565b60208082526010908201527f556e6578706563746564206572726f7200000000000000000000000000000000604082015260600190565b90815260200190565b60405181810167ffffffffffffffff8111828210171561116d57fe5b604052919050565b600067ffffffffffffffff82111561118957fe5b50601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01660200190565b60005b838110156111d05781810151838201526020016111b8565b838111156111df576000848401525b50505050565b73ffffffffffffffffffffffffffffffffffffffff8116811461120757600080fd5b5056fea164736f6c6343000706000a",
  deployedBytecode: "0x608060405234801561001057600080fd5b506004361061007d5760003560e01c8063c45a01551161005b578063c45a0155146100d3578063cdca1753146100db578063f7729d43146100ee578063fa461e33146101015761007d565b80632f80bb1d1461008257806330d07f21146100ab5780634aa4a4fc146100be575b600080fd5b610095610090366004610e9e565b610116565b6040516100a29190611148565b60405180910390f35b6100956100b9366004610e30565b61017b565b6100c6610340565b6040516100a29190611084565b6100c6610364565b6100956100e9366004610e9e565b610388565b6100956100fc366004610e30565b6103d6565b61011461010f366004610f04565b610555565b005b60005b600061012484610660565b9050600080600061013487610668565b92509250925061014882848389600061017b565b955083156101605761015987610699565b965061016c565b85945050505050610175565b50505050610119565b92915050565b600073ffffffffffffffffffffffffffffffffffffffff808616878216109083166101a65760008490555b6101b18787876106ce565b73ffffffffffffffffffffffffffffffffffffffff1663128acb0830836101d78861070c565b60000373ffffffffffffffffffffffffffffffffffffffff8816156101fc5787610222565b8561021b5773fffd8963efd1fc6a506488495d951d5263988d25610222565b6401000276a45b8b8b8e6040516020016102379392919061101e565b6040516020818303038152906040526040518663ffffffff1660e01b81526004016102669594939291906110a5565b6040805180830381600087803b15801561027f57600080fd5b505af19250505080156102cd575060408051601f3d9081017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01682019092526102ca91810190610ee1565b60015b610333573d8080156102fb576040519150601f19603f3d011682016040523d82523d6000602084013e610300565b606091505b5073ffffffffffffffffffffffffffffffffffffffff841661032157600080555b61032a8161073e565b92505050610337565b5050505b95945050505050565b7f000000000000000000000000000000000000000000000000000000000000000081565b7f000000000000000000000000000000000000000000000000000000000000000081565b60005b600061039684610660565b905060008060006103a687610668565b9250925092506103ba8383838960006103d6565b95508315610160576103cb87610699565b96505050505061038b565b600073ffffffffffffffffffffffffffffffffffffffff808616908716106103ff8787876106ce565b73ffffffffffffffffffffffffffffffffffffffff1663128acb0830836104258861070c565b73ffffffffffffffffffffffffffffffffffffffff881615610447578761046d565b856104665773fffd8963efd1fc6a506488495d951d5263988d2561046d565b6401000276a45b8c8b8d6040516020016104829392919061101e565b6040516020818303038152906040526040518663ffffffff1660e01b81526004016104b19594939291906110a5565b6040805180830381600087803b1580156104ca57600080fd5b505af1925050508015610518575060408051601f3d9081017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe016820190925261051591810190610ee1565b60015b610333573d808015610546576040519150601f19603f3d011682016040523d82523d6000602084013e61054b565b606091505b5061032a8161073e565b60008313806105645750600082135b61056d57600080fd5b600080600061057b84610668565b9250925092506105ad7f00000000000000000000000000000000000000000000000000000000000000008484846107ef565b5060008060008089136105f3578573ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff1610888a600003610628565b8473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff161089896000035b925092509250821561063f57604051818152602081fd5b6000541561065557600054811461065557600080fd5b604051828152602081fd5b516042111590565b600080806106768482610805565b9250610683846014610905565b9050610690846017610805565b91509193909250565b80516060906101759083906017907fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe9016109f5565b60006107047f00000000000000000000000000000000000000000000000000000000000000006106ff868686610bdc565b610c59565b949350505050565b60007f8000000000000000000000000000000000000000000000000000000000000000821061073a57600080fd5b5090565b600081516020146107db5760448251101561078e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161078590611111565b60405180910390fd5b600482019150818060200190518101906107a89190610f52565b6040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161078591906110f7565b818060200190518101906101759190610fbc565b600061033785610800868686610bdc565b610d8f565b60008182601401101561087957604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f746f416464726573735f6f766572666c6f770000000000000000000000000000604482015290519081900360640190fd5b81601401835110156108ec57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601560248201527f746f416464726573735f6f75744f66426f756e64730000000000000000000000604482015290519081900360640190fd5b5001602001516c01000000000000000000000000900490565b60008182600301101561097957604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601160248201527f746f55696e7432345f6f766572666c6f77000000000000000000000000000000604482015290519081900360640190fd5b81600301835110156109ec57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601460248201527f746f55696e7432345f6f75744f66426f756e6473000000000000000000000000604482015290519081900360640190fd5b50016003015190565b60608182601f011015610a6957604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600e60248201527f736c6963655f6f766572666c6f77000000000000000000000000000000000000604482015290519081900360640190fd5b828284011015610ada57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600e60248201527f736c6963655f6f766572666c6f77000000000000000000000000000000000000604482015290519081900360640190fd5b81830184511015610b4c57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601160248201527f736c6963655f6f75744f66426f756e6473000000000000000000000000000000604482015290519081900360640190fd5b606082158015610b6b5760405191506000825260208201604052610bd3565b6040519150601f8416801560200281840101858101878315602002848b0101015b81831015610ba4578051835260209283019201610b8c565b5050858452601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe016604052505b50949350505050565b610be4610dbf565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff161115610c1c579192915b506040805160608101825273ffffffffffffffffffffffffffffffffffffffff948516815292909316602083015262ffffff169181019190915290565b6000816020015173ffffffffffffffffffffffffffffffffffffffff16826000015173ffffffffffffffffffffffffffffffffffffffff1610610c9b57600080fd5b508051602080830151604093840151845173ffffffffffffffffffffffffffffffffffffffff94851681850152939091168385015262ffffff166060808401919091528351808403820181526080840185528051908301207fff0000000000000000000000000000000000000000000000000000000000000060a085015294901b7fffffffffffffffffffffffffffffffffffffffff0000000000000000000000001660a183015260b58201939093527fe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b5460d5808301919091528251808303909101815260f5909101909152805191012090565b6000610d9b8383610c59565b90503373ffffffffffffffffffffffffffffffffffffffff82161461017557600080fd5b604080516060810182526000808252602082018190529181019190915290565b600082601f830112610def578081fd5b8135610e02610dfd82611175565b611151565b818152846020838601011115610e16578283fd5b816020850160208301379081016020019190915292915050565b600080600080600060a08688031215610e47578081fd5b8535610e52816111e5565b94506020860135610e62816111e5565b9350604086013562ffffff81168114610e79578182fd5b9250606086013591506080860135610e90816111e5565b809150509295509295909350565b60008060408385031215610eb0578182fd5b823567ffffffffffffffff811115610ec6578283fd5b610ed285828601610ddf565b95602094909401359450505050565b60008060408385031215610ef3578182fd5b505080516020909101519092909150565b600080600060608486031215610f18578283fd5b8335925060208401359150604084013567ffffffffffffffff811115610f3c578182fd5b610f4886828701610ddf565b9150509250925092565b600060208284031215610f63578081fd5b815167ffffffffffffffff811115610f79578182fd5b8201601f81018413610f89578182fd5b8051610f97610dfd82611175565b818152856020838501011115610fab578384fd5b6103378260208301602086016111b5565b600060208284031215610fcd578081fd5b5051919050565b60008151808452610fec8160208601602086016111b5565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b606093841b7fffffffffffffffffffffffffffffffffffffffff000000000000000000000000908116825260e89390931b7fffffff0000000000000000000000000000000000000000000000000000000000166014820152921b166017820152602b0190565b73ffffffffffffffffffffffffffffffffffffffff91909116815260200190565b600073ffffffffffffffffffffffffffffffffffffffff8088168352861515602084015285604084015280851660608401525060a060808301526110ec60a0830184610fd4565b979650505050505050565b60006020825261110a6020830184610fd4565b9392505050565b60208082526010908201527f556e6578706563746564206572726f7200000000000000000000000000000000604082015260600190565b90815260200190565b60405181810167ffffffffffffffff8111828210171561116d57fe5b604052919050565b600067ffffffffffffffff82111561118957fe5b50601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01660200190565b60005b838110156111d05781810151838201526020016111b8565b838111156111df576000848401525b50505050565b73ffffffffffffffffffffffffffffffffffffffff8116811461120757600080fd5b5056fea164736f6c6343000706000a",
  linkReferences: {},
  deployedLinkReferences: {}
};

// ../../node_modules/@uniswap/swap-router-contracts/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json
var QuoterV2_default = {
  _format: "hh-sol-artifact-1",
  contractName: "QuoterV2",
  sourceName: "contracts/lens/QuoterV2.sol",
  abi: [
    {
      inputs: [
        {
          internalType: "address",
          name: "_factory",
          type: "address"
        },
        {
          internalType: "address",
          name: "_WETH9",
          type: "address"
        }
      ],
      stateMutability: "nonpayable",
      type: "constructor"
    },
    {
      inputs: [],
      name: "WETH9",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "factory",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "bytes",
          name: "path",
          type: "bytes"
        },
        {
          internalType: "uint256",
          name: "amountIn",
          type: "uint256"
        }
      ],
      name: "quoteExactInput",
      outputs: [
        {
          internalType: "uint256",
          name: "amountOut",
          type: "uint256"
        },
        {
          internalType: "uint160[]",
          name: "sqrtPriceX96AfterList",
          type: "uint160[]"
        },
        {
          internalType: "uint32[]",
          name: "initializedTicksCrossedList",
          type: "uint32[]"
        },
        {
          internalType: "uint256",
          name: "gasEstimate",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "address",
              name: "tokenIn",
              type: "address"
            },
            {
              internalType: "address",
              name: "tokenOut",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "amountIn",
              type: "uint256"
            },
            {
              internalType: "uint24",
              name: "fee",
              type: "uint24"
            },
            {
              internalType: "uint160",
              name: "sqrtPriceLimitX96",
              type: "uint160"
            }
          ],
          internalType: "struct IQuoterV2.QuoteExactInputSingleParams",
          name: "params",
          type: "tuple"
        }
      ],
      name: "quoteExactInputSingle",
      outputs: [
        {
          internalType: "uint256",
          name: "amountOut",
          type: "uint256"
        },
        {
          internalType: "uint160",
          name: "sqrtPriceX96After",
          type: "uint160"
        },
        {
          internalType: "uint32",
          name: "initializedTicksCrossed",
          type: "uint32"
        },
        {
          internalType: "uint256",
          name: "gasEstimate",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "bytes",
          name: "path",
          type: "bytes"
        },
        {
          internalType: "uint256",
          name: "amountOut",
          type: "uint256"
        }
      ],
      name: "quoteExactOutput",
      outputs: [
        {
          internalType: "uint256",
          name: "amountIn",
          type: "uint256"
        },
        {
          internalType: "uint160[]",
          name: "sqrtPriceX96AfterList",
          type: "uint160[]"
        },
        {
          internalType: "uint32[]",
          name: "initializedTicksCrossedList",
          type: "uint32[]"
        },
        {
          internalType: "uint256",
          name: "gasEstimate",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "address",
              name: "tokenIn",
              type: "address"
            },
            {
              internalType: "address",
              name: "tokenOut",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "amount",
              type: "uint256"
            },
            {
              internalType: "uint24",
              name: "fee",
              type: "uint24"
            },
            {
              internalType: "uint160",
              name: "sqrtPriceLimitX96",
              type: "uint160"
            }
          ],
          internalType: "struct IQuoterV2.QuoteExactOutputSingleParams",
          name: "params",
          type: "tuple"
        }
      ],
      name: "quoteExactOutputSingle",
      outputs: [
        {
          internalType: "uint256",
          name: "amountIn",
          type: "uint256"
        },
        {
          internalType: "uint160",
          name: "sqrtPriceX96After",
          type: "uint160"
        },
        {
          internalType: "uint32",
          name: "initializedTicksCrossed",
          type: "uint32"
        },
        {
          internalType: "uint256",
          name: "gasEstimate",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "int256",
          name: "amount0Delta",
          type: "int256"
        },
        {
          internalType: "int256",
          name: "amount1Delta",
          type: "int256"
        },
        {
          internalType: "bytes",
          name: "path",
          type: "bytes"
        }
      ],
      name: "uniswapV3SwapCallback",
      outputs: [],
      stateMutability: "view",
      type: "function"
    }
  ],
  bytecode: "0x60c06040523480156200001157600080fd5b506040516200212c3803806200212c833981016040819052620000349162000070565b6001600160601b0319606092831b8116608052911b1660a052620000a7565b80516001600160a01b03811681146200006b57600080fd5b919050565b6000806040838503121562000083578182fd5b6200008e8362000053565b91506200009e6020840162000053565b90509250929050565b60805160601c60a05160601c612051620000db60003980610321525080610577528061095d5280610b9252506120516000f3fe608060405234801561001057600080fd5b506004361061007d5760003560e01c8063c45a01551161005b578063c45a0155146100e6578063c6a5026a146100ee578063cdca175314610101578063fa461e33146101145761007d565b80632f80bb1d146100825780634aa4a4fc146100ae578063bd21704a146100c3575b600080fd5b610095610090366004611b2b565b610129565b6040516100a59493929190611eac565b60405180910390f35b6100b661031f565b6040516100a59190611def565b6100d66100d1366004611c49565b610343565b6040516100a59493929190611f54565b6100b6610575565b6100d66100fc366004611c49565b610599565b61009561010f366004611b2b565b610754565b610127610122366004611b91565b61092c565b005b6000606080600061013986610ae8565b67ffffffffffffffff8111801561014f57600080fd5b50604051908082528060200260200182016040528015610179578160200160208202803683370190505b50925061018586610ae8565b67ffffffffffffffff8111801561019b57600080fd5b506040519080825280602002602001820160405280156101c5578160200160208202803683370190505b50915060005b60008060006101d98a610b17565b92509250925060008060008061025c6040518060a001604052808873ffffffffffffffffffffffffffffffffffffffff1681526020018973ffffffffffffffffffffffffffffffffffffffff1681526020018f81526020018762ffffff168152602001600073ffffffffffffffffffffffffffffffffffffffff16815250610343565b9350935093509350828b898151811061027157fe5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050818a89815181106102b857fe5b63ffffffff90921660209283029190910190910152929b50968201966001909601958b926102e58e610b48565b156102fa576102f38e610b50565b9d5061030a565b8c9b505050505050505050610316565b505050505050506101cb565b92959194509250565b7f000000000000000000000000000000000000000000000000000000000000000081565b60208101518151606083015160009283928392839273ffffffffffffffffffffffffffffffffffffffff808216908416109284926103819290610b8b565b9050866080015173ffffffffffffffffffffffffffffffffffffffff16600014156103af5760408701516000555b60005a90508173ffffffffffffffffffffffffffffffffffffffff1663128acb0830856103df8c60400151610bc9565b6000038c6080015173ffffffffffffffffffffffffffffffffffffffff1660001461040e578c60800151610434565b8761042d5773fffd8963efd1fc6a506488495d951d5263988d25610434565b6401000276a45b8d602001518e606001518f6000015160405160200161045593929190611d89565b6040516020818303038152906040526040518663ffffffff1660e01b8152600401610484959493929190611e10565b6040805180830381600087803b15801561049d57600080fd5b505af19250505080156104eb575060408051601f3d9081017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01682019092526104e891810190611b6e565b60015b610568573d808015610519576040519150601f19603f3d011682016040523d82523d6000602084013e61051e565b606091505b505a82039450886080015173ffffffffffffffffffffffffffffffffffffffff166000141561054c57600080555b610557818487610bfb565b97509750975097505050505061056e565b50505050505b9193509193565b7f000000000000000000000000000000000000000000000000000000000000000081565b60208101518151606083015160009283928392839273ffffffffffffffffffffffffffffffffffffffff808216908416109284926105d79290610b8b565b905060005a90508173ffffffffffffffffffffffffffffffffffffffff1663128acb0830856106098c60400151610bc9565b60808d015173ffffffffffffffffffffffffffffffffffffffff1615610633578c60800151610659565b876106525773fffd8963efd1fc6a506488495d951d5263988d25610659565b6401000276a45b8d600001518e606001518f6020015160405160200161067a93929190611d89565b6040516020818303038152906040526040518663ffffffff1660e01b81526004016106a9959493929190611e10565b6040805180830381600087803b1580156106c257600080fd5b505af1925050508015610710575060408051601f3d9081017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe016820190925261070d91810190611b6e565b60015b610568573d80801561073e576040519150601f19603f3d011682016040523d82523d6000602084013e610743565b606091505b505a82039450610557818487610bfb565b6000606080600061076486610ae8565b67ffffffffffffffff8111801561077a57600080fd5b506040519080825280602002602001820160405280156107a4578160200160208202803683370190505b5092506107b086610ae8565b67ffffffffffffffff811180156107c657600080fd5b506040519080825280602002602001820160405280156107f0578160200160208202803683370190505b50915060005b60008060006108048a610b17565b9250925092506000806000806108876040518060a001604052808973ffffffffffffffffffffffffffffffffffffffff1681526020018873ffffffffffffffffffffffffffffffffffffffff1681526020018f81526020018762ffffff168152602001600073ffffffffffffffffffffffffffffffffffffffff16815250610599565b9350935093509350828b898151811061089c57fe5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050818a89815181106108e357fe5b63ffffffff90921660209283029190910190910152929b50968201966001909601958b926109108e610b48565b156102fa5761091e8e610b50565b9d50505050505050506107f6565b600083138061093b5750600082135b61094457600080fd5b600080600061095284610b17565b9250925092506109847f0000000000000000000000000000000000000000000000000000000000000000848484610ccf565b5060008060008089136109ca578573ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff1610888a6000036109ff565b8473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff161089896000035b9250925092506000610a12878787610b8b565b90506000808273ffffffffffffffffffffffffffffffffffffffff16633850c7bd6040518163ffffffff1660e01b815260040160e06040518083038186803b158015610a5d57600080fd5b505afa158015610a71573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610a959190611c6b565b5050505050915091508515610abb57604051848152826020820152816040820152606081fd5b60005415610ad1576000548414610ad157600080fd5b604051858152826020820152816040820152606081fd5b805160177fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec909101045b919050565b60008080610b258482610cee565b9250610b32846014610dee565b9050610b3f846017610cee565b91509193909250565b516042111590565b8051606090610b859083906017907fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe901610ede565b92915050565b6000610bc17f0000000000000000000000000000000000000000000000000000000000000000610bbc8686866110c5565b611142565b949350505050565b60007f80000000000000000000000000000000000000000000000000000000000000008210610bf757600080fd5b5090565b6000806000806000808773ffffffffffffffffffffffffffffffffffffffff16633850c7bd6040518163ffffffff1660e01b815260040160e06040518083038186803b158015610c4a57600080fd5b505afa158015610c5e573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610c829190611c6b565b50939650610c9794508d935061127892505050565b91975095509050610cbf73ffffffffffffffffffffffffffffffffffffffff89168383611339565b9350869250505093509350935093565b6000610ce585610ce08686866110c5565b611991565b95945050505050565b600081826014011015610d6257604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f746f416464726573735f6f766572666c6f770000000000000000000000000000604482015290519081900360640190fd5b8160140183511015610dd557604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601560248201527f746f416464726573735f6f75744f66426f756e64730000000000000000000000604482015290519081900360640190fd5b5001602001516c01000000000000000000000000900490565b600081826003011015610e6257604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601160248201527f746f55696e7432345f6f766572666c6f77000000000000000000000000000000604482015290519081900360640190fd5b8160030183511015610ed557604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601460248201527f746f55696e7432345f6f75744f66426f756e6473000000000000000000000000604482015290519081900360640190fd5b50016003015190565b60608182601f011015610f5257604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600e60248201527f736c6963655f6f766572666c6f77000000000000000000000000000000000000604482015290519081900360640190fd5b828284011015610fc357604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600e60248201527f736c6963655f6f766572666c6f77000000000000000000000000000000000000604482015290519081900360640190fd5b8183018451101561103557604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601160248201527f736c6963655f6f75744f66426f756e6473000000000000000000000000000000604482015290519081900360640190fd5b60608215801561105457604051915060008252602082016040526110bc565b6040519150601f8416801560200281840101858101878315602002848b0101015b8183101561108d578051835260209283019201611075565b5050858452601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe016604052505b50949350505050565b6110cd6119fa565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff161115611105579192915b506040805160608101825273ffffffffffffffffffffffffffffffffffffffff948516815292909316602083015262ffffff169181019190915290565b6000816020015173ffffffffffffffffffffffffffffffffffffffff16826000015173ffffffffffffffffffffffffffffffffffffffff161061118457600080fd5b508051602080830151604093840151845173ffffffffffffffffffffffffffffffffffffffff94851681850152939091168385015262ffffff166060808401919091528351808403820181526080840185528051908301207fff0000000000000000000000000000000000000000000000000000000000000060a085015294901b7fffffffffffffffffffffffffffffffffffffffff0000000000000000000000001660a183015260b58201939093527fe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b5460d5808301919091528251808303909101815260f5909101909152805191012090565b60008060008351606014611318576044845110156112cb576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016112c290611e75565b60405180910390fd5b600484019350838060200190518101906112e59190611bdf565b6040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016112c29190611e62565b8380602001905181019061132c9190611d02565b9250925092509193909250565b60008060008060008060008060088b73ffffffffffffffffffffffffffffffffffffffff1663d0c93a7c6040518163ffffffff1660e01b815260040160206040518083038186803b15801561138d57600080fd5b505afa1580156113a1573d6000803e3d6000fd5b505050506040513d60208110156113b757600080fd5b5051600290810b908c900b816113c957fe5b0560020b901d905060006101008c73ffffffffffffffffffffffffffffffffffffffff1663d0c93a7c6040518163ffffffff1660e01b815260040160206040518083038186803b15801561141c57600080fd5b505afa158015611430573d6000803e3d6000fd5b505050506040513d602081101561144657600080fd5b5051600290810b908d900b8161145857fe5b0560020b8161146357fe5b079050600060088d73ffffffffffffffffffffffffffffffffffffffff1663d0c93a7c6040518163ffffffff1660e01b815260040160206040518083038186803b1580156114b057600080fd5b505afa1580156114c4573d6000803e3d6000fd5b505050506040513d60208110156114da57600080fd5b5051600290810b908d900b816114ec57fe5b0560020b901d905060006101008e73ffffffffffffffffffffffffffffffffffffffff1663d0c93a7c6040518163ffffffff1660e01b815260040160206040518083038186803b15801561153f57600080fd5b505afa158015611553573d6000803e3d6000fd5b505050506040513d602081101561156957600080fd5b5051600290810b908e900b8161157b57fe5b0560020b8161158657fe5b07905060008160ff166001901b8f73ffffffffffffffffffffffffffffffffffffffff16635339c296856040518263ffffffff1660e01b8152600401808260010b815260200191505060206040518083038186803b1580156115e757600080fd5b505afa1580156115fb573d6000803e3d6000fd5b505050506040513d602081101561161157600080fd5b5051161180156116a457508d73ffffffffffffffffffffffffffffffffffffffff1663d0c93a7c6040518163ffffffff1660e01b815260040160206040518083038186803b15801561166257600080fd5b505afa158015611676573d6000803e3d6000fd5b505050506040513d602081101561168c57600080fd5b5051600290810b908d900b8161169e57fe5b0760020b155b80156116b557508b60020b8d60020b135b945060008360ff166001901b8f73ffffffffffffffffffffffffffffffffffffffff16635339c296876040518263ffffffff1660e01b8152600401808260010b815260200191505060206040518083038186803b15801561171557600080fd5b505afa158015611729573d6000803e3d6000fd5b505050506040513d602081101561173f57600080fd5b5051161180156117d257508d73ffffffffffffffffffffffffffffffffffffffff1663d0c93a7c6040518163ffffffff1660e01b815260040160206040518083038186803b15801561179057600080fd5b505afa1580156117a4573d6000803e3d6000fd5b505050506040513d60208110156117ba57600080fd5b5051600290810b908e900b816117cc57fe5b0760020b155b80156117e357508b60020b8d60020b125b95508160010b8460010b128061180f57508160010b8460010b14801561180f57508060ff168360ff1611155b1561182557839950829750819850809650611832565b8199508097508398508296505b50507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff60ff87161b9150505b8560010b8760010b13611969578560010b8760010b14156118a3577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff60ff858103161c165b6000818c73ffffffffffffffffffffffffffffffffffffffff16635339c2968a6040518263ffffffff1660e01b8152600401808260010b815260200191505060206040518083038186803b1580156118fa57600080fd5b505afa15801561190e573d6000803e3d6000fd5b505050506040513d602081101561192457600080fd5b5051169050611932816119c1565b61ffff16989098019750506001909501947fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff61185e565b8115611976576001880397505b8215611983576001880397505b505050505050509392505050565b600061199d8383611142565b90503373ffffffffffffffffffffffffffffffffffffffff821614610b8557600080fd5b6000805b8215610b85577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8301909216916001016119c5565b604080516060810182526000808252602082018190529181019190915290565b600082601f830112611a2a578081fd5b8135611a3d611a3882611faf565b611f8b565b818152846020838601011115611a51578283fd5b816020850160208301379081016020019190915292915050565b8051600281900b8114610b1257600080fd5b600060a08284031215611a8e578081fd5b60405160a0810181811067ffffffffffffffff82111715611aab57fe5b6040529050808235611abc8161201f565b81526020830135611acc8161201f565b602082015260408381013590820152606083013562ffffff81168114611af157600080fd5b6060820152611b0260808401611b0e565b60808201525092915050565b8035610b128161201f565b805161ffff81168114610b1257600080fd5b60008060408385031215611b3d578182fd5b823567ffffffffffffffff811115611b53578283fd5b611b5f85828601611a1a565b95602094909401359450505050565b60008060408385031215611b80578182fd5b505080516020909101519092909150565b600080600060608486031215611ba5578081fd5b8335925060208401359150604084013567ffffffffffffffff811115611bc9578182fd5b611bd586828701611a1a565b9150509250925092565b600060208284031215611bf0578081fd5b815167ffffffffffffffff811115611c06578182fd5b8201601f81018413611c16578182fd5b8051611c24611a3882611faf565b818152856020838501011115611c38578384fd5b610ce5826020830160208601611fef565b600060a08284031215611c5a578081fd5b611c648383611a7d565b9392505050565b600080600080600080600060e0888a031215611c85578283fd5b8751611c908161201f565b9650611c9e60208901611a6b565b9550611cac60408901611b19565b9450611cba60608901611b19565b9350611cc860808901611b19565b925060a088015160ff81168114611cdd578283fd5b60c08901519092508015158114611cf2578182fd5b8091505092959891949750929550565b600080600060608486031215611d16578081fd5b835192506020840151611d288161201f565b9150611d3660408501611a6b565b90509250925092565b60008151808452611d57816020860160208601611fef565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b606093841b7fffffffffffffffffffffffffffffffffffffffff000000000000000000000000908116825260e89390931b7fffffff0000000000000000000000000000000000000000000000000000000000166014820152921b166017820152602b0190565b73ffffffffffffffffffffffffffffffffffffffff91909116815260200190565b600073ffffffffffffffffffffffffffffffffffffffff8088168352861515602084015285604084015280851660608401525060a06080830152611e5760a0830184611d3f565b979650505050505050565b600060208252611c646020830184611d3f565b60208082526010908201527f556e6578706563746564206572726f7200000000000000000000000000000000604082015260600190565b600060808201868352602060808185015281875180845260a0860191508289019350845b81811015611f0257845173ffffffffffffffffffffffffffffffffffffffff1683529383019391830191600101611ed0565b505084810360408601528651808252908201925081870190845b81811015611f3e57825163ffffffff1685529383019391830191600101611f1c565b5050505060609290920192909252949350505050565b93845273ffffffffffffffffffffffffffffffffffffffff92909216602084015263ffffffff166040830152606082015260800190565b60405181810167ffffffffffffffff81118282101715611fa757fe5b604052919050565b600067ffffffffffffffff821115611fc357fe5b50601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01660200190565b60005b8381101561200a578181015183820152602001611ff2565b83811115612019576000848401525b50505050565b73ffffffffffffffffffffffffffffffffffffffff8116811461204157600080fd5b5056fea164736f6c6343000706000a",
  deployedBytecode: "0x608060405234801561001057600080fd5b506004361061007d5760003560e01c8063c45a01551161005b578063c45a0155146100e6578063c6a5026a146100ee578063cdca175314610101578063fa461e33146101145761007d565b80632f80bb1d146100825780634aa4a4fc146100ae578063bd21704a146100c3575b600080fd5b610095610090366004611b2b565b610129565b6040516100a59493929190611eac565b60405180910390f35b6100b661031f565b6040516100a59190611def565b6100d66100d1366004611c49565b610343565b6040516100a59493929190611f54565b6100b6610575565b6100d66100fc366004611c49565b610599565b61009561010f366004611b2b565b610754565b610127610122366004611b91565b61092c565b005b6000606080600061013986610ae8565b67ffffffffffffffff8111801561014f57600080fd5b50604051908082528060200260200182016040528015610179578160200160208202803683370190505b50925061018586610ae8565b67ffffffffffffffff8111801561019b57600080fd5b506040519080825280602002602001820160405280156101c5578160200160208202803683370190505b50915060005b60008060006101d98a610b17565b92509250925060008060008061025c6040518060a001604052808873ffffffffffffffffffffffffffffffffffffffff1681526020018973ffffffffffffffffffffffffffffffffffffffff1681526020018f81526020018762ffffff168152602001600073ffffffffffffffffffffffffffffffffffffffff16815250610343565b9350935093509350828b898151811061027157fe5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050818a89815181106102b857fe5b63ffffffff90921660209283029190910190910152929b50968201966001909601958b926102e58e610b48565b156102fa576102f38e610b50565b9d5061030a565b8c9b505050505050505050610316565b505050505050506101cb565b92959194509250565b7f000000000000000000000000000000000000000000000000000000000000000081565b60208101518151606083015160009283928392839273ffffffffffffffffffffffffffffffffffffffff808216908416109284926103819290610b8b565b9050866080015173ffffffffffffffffffffffffffffffffffffffff16600014156103af5760408701516000555b60005a90508173ffffffffffffffffffffffffffffffffffffffff1663128acb0830856103df8c60400151610bc9565b6000038c6080015173ffffffffffffffffffffffffffffffffffffffff1660001461040e578c60800151610434565b8761042d5773fffd8963efd1fc6a506488495d951d5263988d25610434565b6401000276a45b8d602001518e606001518f6000015160405160200161045593929190611d89565b6040516020818303038152906040526040518663ffffffff1660e01b8152600401610484959493929190611e10565b6040805180830381600087803b15801561049d57600080fd5b505af19250505080156104eb575060408051601f3d9081017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01682019092526104e891810190611b6e565b60015b610568573d808015610519576040519150601f19603f3d011682016040523d82523d6000602084013e61051e565b606091505b505a82039450886080015173ffffffffffffffffffffffffffffffffffffffff166000141561054c57600080555b610557818487610bfb565b97509750975097505050505061056e565b50505050505b9193509193565b7f000000000000000000000000000000000000000000000000000000000000000081565b60208101518151606083015160009283928392839273ffffffffffffffffffffffffffffffffffffffff808216908416109284926105d79290610b8b565b905060005a90508173ffffffffffffffffffffffffffffffffffffffff1663128acb0830856106098c60400151610bc9565b60808d015173ffffffffffffffffffffffffffffffffffffffff1615610633578c60800151610659565b876106525773fffd8963efd1fc6a506488495d951d5263988d25610659565b6401000276a45b8d600001518e606001518f6020015160405160200161067a93929190611d89565b6040516020818303038152906040526040518663ffffffff1660e01b81526004016106a9959493929190611e10565b6040805180830381600087803b1580156106c257600080fd5b505af1925050508015610710575060408051601f3d9081017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe016820190925261070d91810190611b6e565b60015b610568573d80801561073e576040519150601f19603f3d011682016040523d82523d6000602084013e610743565b606091505b505a82039450610557818487610bfb565b6000606080600061076486610ae8565b67ffffffffffffffff8111801561077a57600080fd5b506040519080825280602002602001820160405280156107a4578160200160208202803683370190505b5092506107b086610ae8565b67ffffffffffffffff811180156107c657600080fd5b506040519080825280602002602001820160405280156107f0578160200160208202803683370190505b50915060005b60008060006108048a610b17565b9250925092506000806000806108876040518060a001604052808973ffffffffffffffffffffffffffffffffffffffff1681526020018873ffffffffffffffffffffffffffffffffffffffff1681526020018f81526020018762ffffff168152602001600073ffffffffffffffffffffffffffffffffffffffff16815250610599565b9350935093509350828b898151811061089c57fe5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050818a89815181106108e357fe5b63ffffffff90921660209283029190910190910152929b50968201966001909601958b926109108e610b48565b156102fa5761091e8e610b50565b9d50505050505050506107f6565b600083138061093b5750600082135b61094457600080fd5b600080600061095284610b17565b9250925092506109847f0000000000000000000000000000000000000000000000000000000000000000848484610ccf565b5060008060008089136109ca578573ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff1610888a6000036109ff565b8473ffffffffffffffffffffffffffffffffffffffff168673ffffffffffffffffffffffffffffffffffffffff161089896000035b9250925092506000610a12878787610b8b565b90506000808273ffffffffffffffffffffffffffffffffffffffff16633850c7bd6040518163ffffffff1660e01b815260040160e06040518083038186803b158015610a5d57600080fd5b505afa158015610a71573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610a959190611c6b565b5050505050915091508515610abb57604051848152826020820152816040820152606081fd5b60005415610ad1576000548414610ad157600080fd5b604051858152826020820152816040820152606081fd5b805160177fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec909101045b919050565b60008080610b258482610cee565b9250610b32846014610dee565b9050610b3f846017610cee565b91509193909250565b516042111590565b8051606090610b859083906017907fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe901610ede565b92915050565b6000610bc17f0000000000000000000000000000000000000000000000000000000000000000610bbc8686866110c5565b611142565b949350505050565b60007f80000000000000000000000000000000000000000000000000000000000000008210610bf757600080fd5b5090565b6000806000806000808773ffffffffffffffffffffffffffffffffffffffff16633850c7bd6040518163ffffffff1660e01b815260040160e06040518083038186803b158015610c4a57600080fd5b505afa158015610c5e573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610c829190611c6b565b50939650610c9794508d935061127892505050565b91975095509050610cbf73ffffffffffffffffffffffffffffffffffffffff89168383611339565b9350869250505093509350935093565b6000610ce585610ce08686866110c5565b611991565b95945050505050565b600081826014011015610d6257604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f746f416464726573735f6f766572666c6f770000000000000000000000000000604482015290519081900360640190fd5b8160140183511015610dd557604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601560248201527f746f416464726573735f6f75744f66426f756e64730000000000000000000000604482015290519081900360640190fd5b5001602001516c01000000000000000000000000900490565b600081826003011015610e6257604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601160248201527f746f55696e7432345f6f766572666c6f77000000000000000000000000000000604482015290519081900360640190fd5b8160030183511015610ed557604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601460248201527f746f55696e7432345f6f75744f66426f756e6473000000000000000000000000604482015290519081900360640190fd5b50016003015190565b60608182601f011015610f5257604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600e60248201527f736c6963655f6f766572666c6f77000000000000000000000000000000000000604482015290519081900360640190fd5b828284011015610fc357604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600e60248201527f736c6963655f6f766572666c6f77000000000000000000000000000000000000604482015290519081900360640190fd5b8183018451101561103557604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601160248201527f736c6963655f6f75744f66426f756e6473000000000000000000000000000000604482015290519081900360640190fd5b60608215801561105457604051915060008252602082016040526110bc565b6040519150601f8416801560200281840101858101878315602002848b0101015b8183101561108d578051835260209283019201611075565b5050858452601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe016604052505b50949350505050565b6110cd6119fa565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff161115611105579192915b506040805160608101825273ffffffffffffffffffffffffffffffffffffffff948516815292909316602083015262ffffff169181019190915290565b6000816020015173ffffffffffffffffffffffffffffffffffffffff16826000015173ffffffffffffffffffffffffffffffffffffffff161061118457600080fd5b508051602080830151604093840151845173ffffffffffffffffffffffffffffffffffffffff94851681850152939091168385015262ffffff166060808401919091528351808403820181526080840185528051908301207fff0000000000000000000000000000000000000000000000000000000000000060a085015294901b7fffffffffffffffffffffffffffffffffffffffff0000000000000000000000001660a183015260b58201939093527fe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b5460d5808301919091528251808303909101815260f5909101909152805191012090565b60008060008351606014611318576044845110156112cb576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016112c290611e75565b60405180910390fd5b600484019350838060200190518101906112e59190611bdf565b6040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016112c29190611e62565b8380602001905181019061132c9190611d02565b9250925092509193909250565b60008060008060008060008060088b73ffffffffffffffffffffffffffffffffffffffff1663d0c93a7c6040518163ffffffff1660e01b815260040160206040518083038186803b15801561138d57600080fd5b505afa1580156113a1573d6000803e3d6000fd5b505050506040513d60208110156113b757600080fd5b5051600290810b908c900b816113c957fe5b0560020b901d905060006101008c73ffffffffffffffffffffffffffffffffffffffff1663d0c93a7c6040518163ffffffff1660e01b815260040160206040518083038186803b15801561141c57600080fd5b505afa158015611430573d6000803e3d6000fd5b505050506040513d602081101561144657600080fd5b5051600290810b908d900b8161145857fe5b0560020b8161146357fe5b079050600060088d73ffffffffffffffffffffffffffffffffffffffff1663d0c93a7c6040518163ffffffff1660e01b815260040160206040518083038186803b1580156114b057600080fd5b505afa1580156114c4573d6000803e3d6000fd5b505050506040513d60208110156114da57600080fd5b5051600290810b908d900b816114ec57fe5b0560020b901d905060006101008e73ffffffffffffffffffffffffffffffffffffffff1663d0c93a7c6040518163ffffffff1660e01b815260040160206040518083038186803b15801561153f57600080fd5b505afa158015611553573d6000803e3d6000fd5b505050506040513d602081101561156957600080fd5b5051600290810b908e900b8161157b57fe5b0560020b8161158657fe5b07905060008160ff166001901b8f73ffffffffffffffffffffffffffffffffffffffff16635339c296856040518263ffffffff1660e01b8152600401808260010b815260200191505060206040518083038186803b1580156115e757600080fd5b505afa1580156115fb573d6000803e3d6000fd5b505050506040513d602081101561161157600080fd5b5051161180156116a457508d73ffffffffffffffffffffffffffffffffffffffff1663d0c93a7c6040518163ffffffff1660e01b815260040160206040518083038186803b15801561166257600080fd5b505afa158015611676573d6000803e3d6000fd5b505050506040513d602081101561168c57600080fd5b5051600290810b908d900b8161169e57fe5b0760020b155b80156116b557508b60020b8d60020b135b945060008360ff166001901b8f73ffffffffffffffffffffffffffffffffffffffff16635339c296876040518263ffffffff1660e01b8152600401808260010b815260200191505060206040518083038186803b15801561171557600080fd5b505afa158015611729573d6000803e3d6000fd5b505050506040513d602081101561173f57600080fd5b5051161180156117d257508d73ffffffffffffffffffffffffffffffffffffffff1663d0c93a7c6040518163ffffffff1660e01b815260040160206040518083038186803b15801561179057600080fd5b505afa1580156117a4573d6000803e3d6000fd5b505050506040513d60208110156117ba57600080fd5b5051600290810b908e900b816117cc57fe5b0760020b155b80156117e357508b60020b8d60020b125b95508160010b8460010b128061180f57508160010b8460010b14801561180f57508060ff168360ff1611155b1561182557839950829750819850809650611832565b8199508097508398508296505b50507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff60ff87161b9150505b8560010b8760010b13611969578560010b8760010b14156118a3577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff60ff858103161c165b6000818c73ffffffffffffffffffffffffffffffffffffffff16635339c2968a6040518263ffffffff1660e01b8152600401808260010b815260200191505060206040518083038186803b1580156118fa57600080fd5b505afa15801561190e573d6000803e3d6000fd5b505050506040513d602081101561192457600080fd5b5051169050611932816119c1565b61ffff16989098019750506001909501947fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff61185e565b8115611976576001880397505b8215611983576001880397505b505050505050509392505050565b600061199d8383611142565b90503373ffffffffffffffffffffffffffffffffffffffff821614610b8557600080fd5b6000805b8215610b85577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8301909216916001016119c5565b604080516060810182526000808252602082018190529181019190915290565b600082601f830112611a2a578081fd5b8135611a3d611a3882611faf565b611f8b565b818152846020838601011115611a51578283fd5b816020850160208301379081016020019190915292915050565b8051600281900b8114610b1257600080fd5b600060a08284031215611a8e578081fd5b60405160a0810181811067ffffffffffffffff82111715611aab57fe5b6040529050808235611abc8161201f565b81526020830135611acc8161201f565b602082015260408381013590820152606083013562ffffff81168114611af157600080fd5b6060820152611b0260808401611b0e565b60808201525092915050565b8035610b128161201f565b805161ffff81168114610b1257600080fd5b60008060408385031215611b3d578182fd5b823567ffffffffffffffff811115611b53578283fd5b611b5f85828601611a1a565b95602094909401359450505050565b60008060408385031215611b80578182fd5b505080516020909101519092909150565b600080600060608486031215611ba5578081fd5b8335925060208401359150604084013567ffffffffffffffff811115611bc9578182fd5b611bd586828701611a1a565b9150509250925092565b600060208284031215611bf0578081fd5b815167ffffffffffffffff811115611c06578182fd5b8201601f81018413611c16578182fd5b8051611c24611a3882611faf565b818152856020838501011115611c38578384fd5b610ce5826020830160208601611fef565b600060a08284031215611c5a578081fd5b611c648383611a7d565b9392505050565b600080600080600080600060e0888a031215611c85578283fd5b8751611c908161201f565b9650611c9e60208901611a6b565b9550611cac60408901611b19565b9450611cba60608901611b19565b9350611cc860808901611b19565b925060a088015160ff81168114611cdd578283fd5b60c08901519092508015158114611cf2578182fd5b8091505092959891949750929550565b600080600060608486031215611d16578081fd5b835192506020840151611d288161201f565b9150611d3660408501611a6b565b90509250925092565b60008151808452611d57816020860160208601611fef565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b606093841b7fffffffffffffffffffffffffffffffffffffffff000000000000000000000000908116825260e89390931b7fffffff0000000000000000000000000000000000000000000000000000000000166014820152921b166017820152602b0190565b73ffffffffffffffffffffffffffffffffffffffff91909116815260200190565b600073ffffffffffffffffffffffffffffffffffffffff8088168352861515602084015285604084015280851660608401525060a06080830152611e5760a0830184611d3f565b979650505050505050565b600060208252611c646020830184611d3f565b60208082526010908201527f556e6578706563746564206572726f7200000000000000000000000000000000604082015260600190565b600060808201868352602060808185015281875180845260a0860191508289019350845b81811015611f0257845173ffffffffffffffffffffffffffffffffffffffff1683529383019391830191600101611ed0565b505084810360408601528651808252908201925081870190845b81811015611f3e57825163ffffffff1685529383019391830191600101611f1c565b5050505060609290920192909252949350505050565b93845273ffffffffffffffffffffffffffffffffffffffff92909216602084015263ffffffff166040830152606082015260800190565b60405181810167ffffffffffffffff81118282101715611fa757fe5b604052919050565b600067ffffffffffffffff821115611fc357fe5b50601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01660200190565b60005b8381101561200a578181015183820152602001611ff2565b83811115612019576000848401525b50505050565b73ffffffffffffffffffffffffffffffffffffffff8116811461204157600080fd5b5056fea164736f6c6343000706000a",
  linkReferences: {},
  deployedLinkReferences: {}
};

// ../../node_modules/@uniswap/v3-staker/artifacts/contracts/UniswapV3Staker.sol/UniswapV3Staker.json
var UniswapV3Staker_default = {
  _format: "hh-sol-artifact-1",
  contractName: "UniswapV3Staker",
  sourceName: "contracts/UniswapV3Staker.sol",
  abi: [
    {
      inputs: [
        {
          internalType: "contract IUniswapV3Factory",
          name: "_factory",
          type: "address"
        },
        {
          internalType: "contract INonfungiblePositionManager",
          name: "_nonfungiblePositionManager",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "_maxIncentiveStartLeadTime",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "_maxIncentiveDuration",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "constructor"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          indexed: true,
          internalType: "address",
          name: "oldOwner",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "newOwner",
          type: "address"
        }
      ],
      name: "DepositTransferred",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "contract IERC20Minimal",
          name: "rewardToken",
          type: "address"
        },
        {
          indexed: true,
          internalType: "contract IUniswapV3Pool",
          name: "pool",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "startTime",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "endTime",
          type: "uint256"
        },
        {
          indexed: false,
          internalType: "address",
          name: "refundee",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "reward",
          type: "uint256"
        }
      ],
      name: "IncentiveCreated",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "bytes32",
          name: "incentiveId",
          type: "bytes32"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "refund",
          type: "uint256"
        }
      ],
      name: "IncentiveEnded",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "reward",
          type: "uint256"
        }
      ],
      name: "RewardClaimed",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          indexed: true,
          internalType: "bytes32",
          name: "incentiveId",
          type: "bytes32"
        },
        {
          indexed: false,
          internalType: "uint128",
          name: "liquidity",
          type: "uint128"
        }
      ],
      name: "TokenStaked",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          indexed: true,
          internalType: "bytes32",
          name: "incentiveId",
          type: "bytes32"
        }
      ],
      name: "TokenUnstaked",
      type: "event"
    },
    {
      inputs: [
        {
          internalType: "contract IERC20Minimal",
          name: "rewardToken",
          type: "address"
        },
        {
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "amountRequested",
          type: "uint256"
        }
      ],
      name: "claimReward",
      outputs: [
        {
          internalType: "uint256",
          name: "reward",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "contract IERC20Minimal",
              name: "rewardToken",
              type: "address"
            },
            {
              internalType: "contract IUniswapV3Pool",
              name: "pool",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "startTime",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "endTime",
              type: "uint256"
            },
            {
              internalType: "address",
              name: "refundee",
              type: "address"
            }
          ],
          internalType: "struct IUniswapV3Staker.IncentiveKey",
          name: "key",
          type: "tuple"
        },
        {
          internalType: "uint256",
          name: "reward",
          type: "uint256"
        }
      ],
      name: "createIncentive",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      name: "deposits",
      outputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          internalType: "uint48",
          name: "numberOfStakes",
          type: "uint48"
        },
        {
          internalType: "int24",
          name: "tickLower",
          type: "int24"
        },
        {
          internalType: "int24",
          name: "tickUpper",
          type: "int24"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "contract IERC20Minimal",
              name: "rewardToken",
              type: "address"
            },
            {
              internalType: "contract IUniswapV3Pool",
              name: "pool",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "startTime",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "endTime",
              type: "uint256"
            },
            {
              internalType: "address",
              name: "refundee",
              type: "address"
            }
          ],
          internalType: "struct IUniswapV3Staker.IncentiveKey",
          name: "key",
          type: "tuple"
        }
      ],
      name: "endIncentive",
      outputs: [
        {
          internalType: "uint256",
          name: "refund",
          type: "uint256"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "factory",
      outputs: [
        {
          internalType: "contract IUniswapV3Factory",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "contract IERC20Minimal",
              name: "rewardToken",
              type: "address"
            },
            {
              internalType: "contract IUniswapV3Pool",
              name: "pool",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "startTime",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "endTime",
              type: "uint256"
            },
            {
              internalType: "address",
              name: "refundee",
              type: "address"
            }
          ],
          internalType: "struct IUniswapV3Staker.IncentiveKey",
          name: "key",
          type: "tuple"
        },
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "getRewardInfo",
      outputs: [
        {
          internalType: "uint256",
          name: "reward",
          type: "uint256"
        },
        {
          internalType: "uint160",
          name: "secondsInsideX128",
          type: "uint160"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "bytes32",
          name: "",
          type: "bytes32"
        }
      ],
      name: "incentives",
      outputs: [
        {
          internalType: "uint256",
          name: "totalRewardUnclaimed",
          type: "uint256"
        },
        {
          internalType: "uint160",
          name: "totalSecondsClaimedX128",
          type: "uint160"
        },
        {
          internalType: "uint96",
          name: "numberOfStakes",
          type: "uint96"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "maxIncentiveDuration",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "maxIncentiveStartLeadTime",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "bytes[]",
          name: "data",
          type: "bytes[]"
        }
      ],
      name: "multicall",
      outputs: [
        {
          internalType: "bytes[]",
          name: "results",
          type: "bytes[]"
        }
      ],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [],
      name: "nonfungiblePositionManager",
      outputs: [
        {
          internalType: "contract INonfungiblePositionManager",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        },
        {
          internalType: "address",
          name: "from",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          internalType: "bytes",
          name: "data",
          type: "bytes"
        }
      ],
      name: "onERC721Received",
      outputs: [
        {
          internalType: "bytes4",
          name: "",
          type: "bytes4"
        }
      ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "contract IERC20Minimal",
          name: "",
          type: "address"
        },
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      name: "rewards",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "contract IERC20Minimal",
              name: "rewardToken",
              type: "address"
            },
            {
              internalType: "contract IUniswapV3Pool",
              name: "pool",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "startTime",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "endTime",
              type: "uint256"
            },
            {
              internalType: "address",
              name: "refundee",
              type: "address"
            }
          ],
          internalType: "struct IUniswapV3Staker.IncentiveKey",
          name: "key",
          type: "tuple"
        },
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "stakeToken",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          internalType: "bytes32",
          name: "incentiveId",
          type: "bytes32"
        }
      ],
      name: "stakes",
      outputs: [
        {
          internalType: "uint160",
          name: "secondsPerLiquidityInsideInitialX128",
          type: "uint160"
        },
        {
          internalType: "uint128",
          name: "liquidity",
          type: "uint128"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "to",
          type: "address"
        }
      ],
      name: "transferDeposit",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "contract IERC20Minimal",
              name: "rewardToken",
              type: "address"
            },
            {
              internalType: "contract IUniswapV3Pool",
              name: "pool",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "startTime",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "endTime",
              type: "uint256"
            },
            {
              internalType: "address",
              name: "refundee",
              type: "address"
            }
          ],
          internalType: "struct IUniswapV3Staker.IncentiveKey",
          name: "key",
          type: "tuple"
        },
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        }
      ],
      name: "unstakeToken",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "tokenId",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "to",
          type: "address"
        },
        {
          internalType: "bytes",
          name: "data",
          type: "bytes"
        }
      ],
      name: "withdrawToken",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    }
  ],
  bytecode: "0x6101006040523480156200001257600080fd5b5060405162003ba338038062003ba383398101604081905262000035916200005e565b6001600160601b0319606094851b81166080529290931b90911660a05260c05260e052620000c3565b6000806000806080858703121562000074578384fd5b84516200008181620000aa565b60208601519094506200009481620000aa565b6040860151606090960151949790965092505050565b6001600160a01b0381168114620000c057600080fd5b50565b60805160601c60a05160601c60c05160e051613a816200012260003980610bbd5280610cfa5250806103b15280610c595250806103ed52806104525280610b4852806110555280611ad552508061124c5280611ab45250613a816000f3fe6080604052600436106101295760003560e01c8063b02c43d0116100a5578063c45a015511610074578063e70b9e2711610059578063e70b9e271461034f578063f2d2909b1461036f578063f549ab421461038f57610129565b8063c45a01551461030c578063d953186e1461032157610129565b8063b02c43d01461026c578063b44a27221461029c578063b5ada6e4146102be578063c36c1ea5146102de57610129565b80633c423f0b116100fc5780635cc5e3d9116100e15780635cc5e3d9146101fd578063607777951461021d578063ac9650d81461024c57610129565b80633c423f0b146101c85780633dc0714b146101e857610129565b806301b754401461012e578063150b7a021461015957806326bfee04146101865780632f2d783d146101a8575b600080fd5b34801561013a57600080fd5b506101436103af565b60405161015091906138b9565b60405180910390f35b34801561016557600080fd5b5061017961017436600461273f565b6103d3565b6040516101509190612db4565b34801561019257600080fd5b506101a66101a1366004612a9c565b61071c565b005b3480156101b457600080fd5b506101436101c3366004612946565b61084a565b3480156101d457600080fd5b506101a66101e3366004612ac0565b610928565b3480156101f457600080fd5b50610143610bbb565b34801561020957600080fd5b506101a6610218366004612a72565b610bdf565b34801561022957600080fd5b5061023d6102383660046128f6565b610e10565b604051610150939291906138e6565b61025f61025a3660046127d9565b610e67565b6040516101509190612d36565b34801561027857600080fd5b5061028c6102873660046128f6565b610fc1565b6040516101509493929190612cf5565b3480156102a857600080fd5b506102b1611053565b6040516101509190612de1565b3480156102ca57600080fd5b506101436102d9366004612a57565b611077565b3480156102ea57600080fd5b506102fe6102f9366004612b52565b6111c5565b604051610150929190613881565b34801561031857600080fd5b506102b161124a565b34801561032d57600080fd5b5061034161033c366004612a72565b61126e565b6040516101509291906138c2565b34801561035b57600080fd5b5061014361036a36600461290e565b611493565b34801561037b57600080fd5b506101a661038a366004612a72565b6114b0565b34801561039b57600080fd5b506101a66103aa366004612a72565b61151b565b7f000000000000000000000000000000000000000000000000000000000000000081565b60003373ffffffffffffffffffffffffffffffffffffffff7f0000000000000000000000000000000000000000000000000000000000000000161461044d576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104449061375a565b60405180910390fd5b6000807f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166399fbab88876040518263ffffffff1660e01b81526004016104a991906138b9565b6101806040518083038186803b1580156104c257600080fd5b505afa1580156104d6573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906104fa9190612b73565b505050505096509650505050505060405180608001604052808873ffffffffffffffffffffffffffffffffffffffff168152602001600065ffffffffffff1681526020018360020b81526020018260020b8152506001600088815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160000160146101000a81548165ffffffffffff021916908365ffffffffffff160217905550604082015181600001601a6101000a81548162ffffff021916908360020b62ffffff160217905550606082015181600001601d6101000a81548162ffffff021916908360020b62ffffff1602179055509050508673ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff16877fcdfc765b85e1048bee3c6a0f9d1c91fc7c4631f5fe5745a55fc6843db5c3260f60405160405180910390a483156106ef5760a08414156106ab576106a66106a085870187612a57565b87611964565b6106ef565b60006106b985870187612848565b905060005b81518110156106ec576106e48282815181106106d657fe5b602002602001015189611964565b6001016106be565b50505b507f150b7a0200000000000000000000000000000000000000000000000000000000979650505050505050565b73ffffffffffffffffffffffffffffffffffffffff8116610769576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613183565b60008281526001602052604090205473ffffffffffffffffffffffffffffffffffffffff163381146107c7576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490612e86565b60008381526001602052604080822080547fffffffffffffffffffffffff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff868116918217909255915191929084169186917fcdfc765b85e1048bee3c6a0f9d1c91fc7c4631f5fe5745a55fc6843db5c3260f91a4505050565b73ffffffffffffffffffffffffffffffffffffffff83166000908152600360209081526040808320338452909152902054811580159061088957508082105b156108915750805b73ffffffffffffffffffffffffffffffffffffffff841660009081526003602090815260408083203384529091529020805482900390556108d3848483611ed1565b8273ffffffffffffffffffffffffffffffffffffffff167f106f923f993c2149d49b4255ff723acafa1f2d94393f561d3eda32ae348f72418260405161091991906138b9565b60405180910390a29392505050565b73ffffffffffffffffffffffffffffffffffffffff8216301415610978576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906137b7565b6000838152600160209081526040918290208251608081018452905473ffffffffffffffffffffffffffffffffffffffff8116825265ffffffffffff740100000000000000000000000000000000000000008204169282018390527a0100000000000000000000000000000000000000000000000000008104600290810b810b810b948301949094527d0100000000000000000000000000000000000000000000000000000000009004830b830b90920b606083015215610a65576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613046565b805173ffffffffffffffffffffffffffffffffffffffff163314610ab5576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613481565b6000848152600160205260408082208290558251905173ffffffffffffffffffffffffffffffffffffffff9091169086907fcdfc765b85e1048bee3c6a0f9d1c91fc7c4631f5fe5745a55fc6843db5c3260f908490a46040517fb88d4fde00000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff7f0000000000000000000000000000000000000000000000000000000000000000169063b88d4fde90610b83903090879089908890600401612cac565b600060405180830381600087803b158015610b9d57600080fd5b505af1158015610bb1573d6000803e3d6000fd5b5050505050505050565b7f000000000000000000000000000000000000000000000000000000000000000081565b60008111610c19576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906135be565b8160400151421115610c57576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906131e0565b7f0000000000000000000000000000000000000000000000000000000000000000428360400151031115610cb7576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104449061361b565b8160600151826040015110610cf8576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906136d7565b7f000000000000000000000000000000000000000000000000000000000000000082604001518360600151031115610d5c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613679565b6000610d67836120ad565b60008181526020819052604090208054840190558351909150610d8c903330856120de565b826020015173ffffffffffffffffffffffffffffffffffffffff16836000015173ffffffffffffffffffffffffffffffffffffffff167fa876344e28d4b5191ad03bc0d43f740e3695827ab0faccac739930b915ef8b0285604001518660600151876080015187604051610e039493929190613920565b60405180910390a3505050565b6000602081905290815260409020805460019091015473ffffffffffffffffffffffffffffffffffffffff8116907401000000000000000000000000000000000000000090046bffffffffffffffffffffffff1683565b60608167ffffffffffffffff81118015610e8057600080fd5b50604051908082528060200260200182016040528015610eb457816020015b6060815260200190600190039081610e9f5790505b50905060005b82811015610fba5760008030868685818110610ed257fe5b9050602002810190610ee49190613951565b604051610ef2929190612c9c565b600060405180830381855af49150503d8060008114610f2d576040519150601f19603f3d011682016040523d82523d6000602084013e610f32565b606091505b509150915081610f9857604481511015610f4b57600080fd5b60048101905080806020019051810190610f6591906129df565b6040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104449190612e16565b80848481518110610fa557fe5b60209081029190910101525050600101610eba565b5092915050565b60016020526000908152604090205473ffffffffffffffffffffffffffffffffffffffff81169065ffffffffffff74010000000000000000000000000000000000000000820416907a0100000000000000000000000000000000000000000000000000008104600290810b917d0100000000000000000000000000000000000000000000000000000000009004900b84565b7f000000000000000000000000000000000000000000000000000000000000000081565b600081606001514210156110b7576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490612f66565b60006110c2836120ad565b6000818152602081905260409020805493509091508261110e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490612e29565b60018101547401000000000000000000000000000000000000000090046bffffffffffffffffffffffff1615611170576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906134de565b6000815583516080850151611186919085611ed1565b817f65124e6175aa9904f40735e87e2a37c76e87a609b855287bb4d1aba8257d9763846040516111b691906138b9565b60405180910390a25050919050565b60008281526002602090815260408083208484529091529020805473ffffffffffffffffffffffffffffffffffffffff8116916bffffffffffffffffffffffff740100000000000000000000000000000000000000009092048216918214156112425760018101546fffffffffffffffffffffffffffffffff1691505b509250929050565b7f000000000000000000000000000000000000000000000000000000000000000081565b600080600061127c856120ad565b905060008061128b86846111c5565b915091506000816fffffffffffffffffffffffffffffffff16116112db576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490612f09565b60008681526001602081815260408084208151608081018352905473ffffffffffffffffffffffffffffffffffffffff80821683527401000000000000000000000000000000000000000080830465ffffffffffff16848701527a0100000000000000000000000000000000000000000000000000008304600290810b810b810b8587019081527d010000000000000000000000000000000000000000000000000000000000909404810b810b900b60608086019182528c8a52898852868a2087519182018852805482529098015480841689890152919091046bffffffffffffffffffffffff1687860152948e01519151945193517fa38807f200000000000000000000000000000000000000000000000000000000815292969491169263a38807f29261140e929190600401612e02565b60606040518083038186803b15801561142657600080fd5b505afa15801561143a573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061145e9190612986565b50915050611482826000015183602001518c604001518d60600151888a87426122c3565b909b909a5098505050505050505050565b600360209081526000928352604080842090915290825290205481565b60008181526001602052604090205473ffffffffffffffffffffffffffffffffffffffff16331461150d576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613561565b6115178282611964565b5050565b6000818152600160209081526040918290208251608081018452905473ffffffffffffffffffffffffffffffffffffffff8116825265ffffffffffff74010000000000000000000000000000000000000000820416928201929092527a0100000000000000000000000000000000000000000000000000008204600290810b810b810b938201939093527d010000000000000000000000000000000000000000000000000000000000909104820b820b90910b60608083019190915283015142101561163157805173ffffffffffffffffffffffffffffffffffffffff163314611631576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104449061331e565b600061163c846120ad565b905060008061164b85846111c5565b91509150806fffffffffffffffffffffffffffffffff166000141561169c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490612fe9565b600083815260208181526040808320888452600180845282852080547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff65ffffffffffff740100000000000000000000000000000000000000008084048216830190911681027fffffffffffff000000000000ffffffffffffffffffffffffffffffffffffffff9093169290921790925591830180546bffffffffffffffffffffffff848204811690930190921690920273ffffffffffffffffffffffffffffffffffffffff91821617909155928a01518883015160608a015193517fa38807f2000000000000000000000000000000000000000000000000000000008152929594919091169263a38807f2926117b7929190600401612e02565b60606040518083038186803b1580156117cf57600080fd5b505afa1580156117e3573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906118079190612986565b508354600185015460408c015160608d0151939550600094508493611848939273ffffffffffffffffffffffffffffffffffffffff169190898b89426122c3565b6001860180547fffffffffffffffffffffffff0000000000000000000000000000000000000000811673ffffffffffffffffffffffffffffffffffffffff9182168401821617909155865483900387558c51811660009081526003602090815260408083208e5190941683529281528282208054860190558d8252600281528282208c8352905290812090815591935091506bffffffffffffffffffffffff6fffffffffffffffffffffffffffffffff87161061192a576001810180547fffffffffffffffffffffffffffffffff000000000000000000000000000000001690555b60405188908b907fe1ba67e807ae0efa0a9549f9520ddc15c27f0a4dae2bc045e800ca66a940778f90600090a35050505050505050505050565b81604001514210156119a2576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906133a1565b816060015142106119df576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613126565b60006119ea836120ad565b600081815260208190526040902054909150611a32576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906132c1565b60008281526002602090815260408083208484529091529020547401000000000000000000000000000000000000000090046bffffffffffffffffffffffff1615611aa9576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906130c9565b600080600080611afa7f00000000000000000000000000000000000000000000000000000000000000007f000000000000000000000000000000000000000000000000000000000000000088612345565b9350935093509350866020015173ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1614611b6b576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906133fe565b6000816fffffffffffffffffffffffffffffffff1611611bb7576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613263565b6000868152600160208181526040808420805465ffffffffffff740100000000000000000000000000000000000000008083048216870190911681027fffffffffffff000000000000ffffffffffffffffffffffffffffffffffffffff9092169190911790915589855291849052808420830180546bffffffffffffffffffffffff848204811690950190941690920273ffffffffffffffffffffffffffffffffffffffff93841617909155517fa38807f20000000000000000000000000000000000000000000000000000000081529086169063a38807f290611ca19087908790600401612e02565b60606040518083038186803b158015611cb957600080fd5b505afa158015611ccd573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190611cf19190612986565b509150506bffffffffffffffffffffffff6fffffffffffffffffffffffffffffffff831610611e0a576040805160608101825273ffffffffffffffffffffffffffffffffffffffff80841682526bffffffffffffffffffffffff60208084018281526fffffffffffffffffffffffffffffffff80891686880190815260008f8152600285528881208f82529094529690922094518554915190931674010000000000000000000000000000000000000000029284167fffffffffffffffffffffffff000000000000000000000000000000000000000090911617909216178255915160019091018054919092167fffffffffffffffffffffffffffffffff00000000000000000000000000000000909116179055611e8e565b6000878152600260209081526040808320898452909152902080547fffffffffffffffffffffffff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff8381169190911716740100000000000000000000000000000000000000006bffffffffffffffffffffffff8516021790555b85877f3fe90ccd0a34e28f2b4b7a1e8323415ed9dd595f4eec5dfd461d18c2df336dbd84604051611ebf9190613864565b60405180910390a35050505050505050565b6040805173ffffffffffffffffffffffffffffffffffffffff8481166024830152604480830185905283518084039091018152606490920183526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167fa9059cbb000000000000000000000000000000000000000000000000000000001781529251825160009485949389169392918291908083835b60208310611fa657805182527fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe09092019160209182019101611f69565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d8060008114612008576040519150601f19603f3d011682016040523d82523d6000602084013e61200d565b606091505b509150915081801561203b57508051158061203b575080806020019051602081101561203857600080fd5b50515b6120a657604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600260248201527f5354000000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b5050505050565b6000816040516020016120c09190613814565b6040516020818303038152906040528051906020012090505b919050565b6040805173ffffffffffffffffffffffffffffffffffffffff85811660248301528481166044830152606480830185905283518084039091018152608490920183526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167f23b872dd00000000000000000000000000000000000000000000000000000000178152925182516000948594938a169392918291908083835b602083106121bb57805182527fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0909201916020918201910161217e565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d806000811461221d576040519150601f19603f3d011682016040523d82523d6000602084013e612222565b606091505b5091509150818015612250575080511580612250575080806020019051602081101561224d57600080fd5b50515b6122bb57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600360248201527f5354460000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b505050505050565b600080878310156122d057fe5b508383036fffffffffffffffffffffffffffffffff861602600073ffffffffffffffffffffffffffffffffffffffff8a1660808a61230e8b8861244e565b03901b0390506123358b8373ffffffffffffffffffffffffffffffffffffffff1683612467565b9250509850989650505050505050565b60008060008060008060008873ffffffffffffffffffffffffffffffffffffffff166399fbab88896040518263ffffffff1660e01b8152600401808281526020019150506101806040518083038186803b1580156123a257600080fd5b505afa1580156123b6573d6000803e3d6000fd5b505050506040513d6101808110156123cd57600080fd5b50604080820151606080840151608085015160a086015160c087015160e0909701518651948501875273ffffffffffffffffffffffffffffffffffffffff80871686528416602086015262ffffff8316968501969096529b50949950929750909550909350909150612440908b90612534565b965050505093509350935093565b60008183101561245e5781612460565b825b9392505050565b600080807fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff858709868602925082811090839003039050806124bb57600084116124b057600080fd5b508290049050612460565b8084116124c757600080fd5b6000848688096000868103871696879004966002600389028118808a02820302808a02820302808a02820302808a02820302808a02820302808a02909103029181900381900460010186841190950394909402919094039290920491909117919091029150509392505050565b6000816020015173ffffffffffffffffffffffffffffffffffffffff16826000015173ffffffffffffffffffffffffffffffffffffffff161061257657600080fd5b508051602080830151604093840151845173ffffffffffffffffffffffffffffffffffffffff94851681850152939091168385015262ffffff166060808401919091528351808403820181526080840185528051908301207fff0000000000000000000000000000000000000000000000000000000000000060a085015294901b7fffffffffffffffffffffffffffffffffffffffff0000000000000000000000001660a183015260b58201939093527fe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b5460d5808301919091528251808303909101815260f5909101909152805191012090565b80516120d981613a4f565b8051600281900b81146120d957600080fd5b600060a08284031215612698578081fd5b60405160a0810181811067ffffffffffffffff821117156126b557fe5b60405290508082356126c681613a4f565b815260208301356126d681613a4f565b80602083015250604083013560408201526060830135606082015260808301356126ff81613a4f565b6080919091015292915050565b80516fffffffffffffffffffffffffffffffff811681146120d957600080fd5b805162ffffff811681146120d957600080fd5b600080600080600060808688031215612756578081fd5b853561276181613a4f565b9450602086013561277181613a4f565b935060408601359250606086013567ffffffffffffffff80821115612794578283fd5b818801915088601f8301126127a7578283fd5b8135818111156127b5578384fd5b8960208285010111156127c6578384fd5b9699959850939650602001949392505050565b600080602083850312156127eb578182fd5b823567ffffffffffffffff80821115612802578384fd5b818501915085601f830112612815578384fd5b813581811115612823578485fd5b8660208083028501011115612836578485fd5b60209290920196919550909350505050565b6000602080838503121561285a578182fd5b823567ffffffffffffffff80821115612871578384fd5b818501915085601f830112612884578384fd5b81358181111561289057fe5b61289d84858302016139bb565b818152848101925083850160a0808402860187018a10156128bc578788fd5b8795505b838610156128e8576128d28a83612687565b85526001959095019493860193908101906128c0565b509098975050505050505050565b600060208284031215612907578081fd5b5035919050565b60008060408385031215612920578182fd5b823561292b81613a4f565b9150602083013561293b81613a4f565b809150509250929050565b60008060006060848603121561295a578081fd5b833561296581613a4f565b9250602084013561297581613a4f565b929592945050506040919091013590565b60008060006060848603121561299a578081fd5b83518060060b81146129aa578182fd5b60208501519093506129bb81613a4f565b604085015190925063ffffffff811681146129d4578182fd5b809150509250925092565b6000602082840312156129f0578081fd5b815167ffffffffffffffff811115612a06578182fd5b8201601f81018413612a16578182fd5b8051612a29612a24826139df565b6139bb565b818152856020838501011115612a3d578384fd5b612a4e826020830160208601613a1f565b95945050505050565b600060a08284031215612a68578081fd5b6124608383612687565b60008060c08385031215612a84578182fd5b612a8e8484612687565b9460a0939093013593505050565b60008060408385031215612aae578182fd5b82359150602083013561293b81613a4f565b600080600060608486031215612ad4578081fd5b833592506020840135612ae681613a4f565b9150604084013567ffffffffffffffff811115612b01578182fd5b8401601f81018613612b11578182fd5b8035612b1f612a24826139df565b818152876020838501011115612b33578384fd5b8160208401602083013783602083830101528093505050509250925092565b60008060408385031215612b64578182fd5b50508035926020909101359150565b6000806000806000806000806000806000806101808d8f031215612b9557898afd5b8c516bffffffffffffffffffffffff81168114612bb0578a8bfd5b9b50612bbe60208e0161266a565b9a50612bcc60408e0161266a565b9950612bda60608e0161266a565b9850612be860808e0161272c565b9750612bf660a08e01612675565b9650612c0460c08e01612675565b9550612c1260e08e0161270c565b94506101008d015193506101208d01519250612c316101408e0161270c565b9150612c406101608e0161270c565b90509295989b509295989b509295989b565b60008151808452612c6a816020860160208601613a1f565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b6000828483379101908152919050565b600073ffffffffffffffffffffffffffffffffffffffff808716835280861660208401525083604083015260806060830152612ceb6080830184612c52565b9695505050505050565b73ffffffffffffffffffffffffffffffffffffffff94909416845265ffffffffffff929092166020840152600290810b60408401520b606082015260800190565b6000602080830181845280855180835260408601915060408482028701019250838701855b82811015612da7577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc0888603018452612d95858351612c52565b94509285019290850190600101612d5b565b5092979650505050505050565b7fffffffff0000000000000000000000000000000000000000000000000000000091909116815260200190565b73ffffffffffffffffffffffffffffffffffffffff91909116815260200190565b600292830b8152910b602082015260400190565b6000602082526124606020830184612c52565b60208082526032908201527f556e697377617056335374616b65723a3a656e64496e63656e746976653a206e60408201527f6f20726566756e6420617661696c61626c650000000000000000000000000000606082015260800190565b60208082526045908201527f556e697377617056335374616b65723a3a7472616e736665724465706f73697460408201527f3a2063616e206f6e6c792062652063616c6c6564206279206465706f7369742060608201527f6f776e6572000000000000000000000000000000000000000000000000000000608082015260a00190565b60208082526034908201527f556e697377617056335374616b65723a3a676574526577617264496e666f3a2060408201527f7374616b6520646f6573206e6f74206578697374000000000000000000000000606082015260800190565b60208082526043908201527f556e697377617056335374616b65723a3a656e64496e63656e746976653a206360408201527f616e6e6f7420656e6420696e63656e74697665206265666f726520656e64207460608201527f696d650000000000000000000000000000000000000000000000000000000000608082015260a00190565b60208082526033908201527f556e697377617056335374616b65723a3a756e7374616b65546f6b656e3a207360408201527f74616b6520646f6573206e6f7420657869737400000000000000000000000000606082015260800190565b60208082526042908201527f556e697377617056335374616b65723a3a7769746864726177546f6b656e3a2060408201527f63616e6e6f7420776974686472617720746f6b656e207768696c65207374616b60608201527f6564000000000000000000000000000000000000000000000000000000000000608082015260a00190565b60208082526031908201527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a20746f6b60408201527f656e20616c7265616479207374616b6564000000000000000000000000000000606082015260800190565b6020808252602c908201527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a20696e6360408201527f656e7469766520656e6465640000000000000000000000000000000000000000606082015260800190565b6020808252603c908201527f556e697377617056335374616b65723a3a7472616e736665724465706f73697460408201527f3a20696e76616c6964207472616e7366657220726563697069656e7400000000606082015260800190565b60208082526049908201527f556e697377617056335374616b65723a3a637265617465496e63656e7469766560408201527f3a2073746172742074696d65206d757374206265206e6f77206f7220696e207460608201527f6865206675747572650000000000000000000000000000000000000000000000608082015260a00190565b602080825260409082018190527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a2063616e908201527f6e6f74207374616b6520746f6b656e20776974682030206c6971756964697479606082015260800190565b60208082526033908201527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a206e6f6e60408201527f2d6578697374656e7420696e63656e7469766500000000000000000000000000606082015260800190565b60208082526056908201527f556e697377617056335374616b65723a3a756e7374616b65546f6b656e3a206f60408201527f6e6c79206f776e65722063616e20776974686472617720746f6b656e2062656660608201527f6f726520696e63656e7469766520656e642074696d6500000000000000000000608082015260a00190565b60208082526032908201527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a20696e6360408201527f656e74697665206e6f7420737461727465640000000000000000000000000000606082015260800190565b60208082526041908201527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a20746f6b60408201527f656e20706f6f6c206973206e6f742074686520696e63656e7469766520706f6f60608201527f6c00000000000000000000000000000000000000000000000000000000000000608082015260a00190565b6020808252603d908201527f556e697377617056335374616b65723a3a7769746864726177546f6b656e3a2060408201527f6f6e6c79206f776e65722063616e20776974686472617720746f6b656e000000606082015260800190565b6020808252604d908201527f556e697377617056335374616b65723a3a656e64496e63656e746976653a206360408201527f616e6e6f7420656e6420696e63656e74697665207768696c65206465706f736960608201527f747320617265207374616b656400000000000000000000000000000000000000608082015260a00190565b60208082526037908201527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a206f6e6c60408201527f79206f776e65722063616e207374616b6520746f6b656e000000000000000000606082015260800190565b60208082526039908201527f556e697377617056335374616b65723a3a637265617465496e63656e7469766560408201527f3a20726577617264206d75737420626520706f73697469766500000000000000606082015260800190565b602080825260409082018190527f556e697377617056335374616b65723a3a637265617465496e63656e74697665908201527f3a2073746172742074696d6520746f6f2066617220696e746f20667574757265606082015260800190565b602080825260409082018190527f556e697377617056335374616b65723a3a637265617465496e63656e74697665908201527f3a20696e63656e74697665206475726174696f6e20697320746f6f206c6f6e67606082015260800190565b60208082526044908201527f556e697377617056335374616b65723a3a637265617465496e63656e7469766560408201527f3a2073746172742074696d65206d757374206265206265666f726520656e642060608201527f74696d6500000000000000000000000000000000000000000000000000000000608082015260a00190565b60208082526032908201527f556e697377617056335374616b65723a3a6f6e4552433732315265636569766560408201527f643a206e6f74206120756e697633206e66740000000000000000000000000000606082015260800190565b60208082526039908201527f556e697377617056335374616b65723a3a7769746864726177546f6b656e3a2060408201527f63616e6e6f7420776974686472617720746f207374616b657200000000000000606082015260800190565b815173ffffffffffffffffffffffffffffffffffffffff90811682526020808401518216908301526040808401519083015260608084015190830152608092830151169181019190915260a00190565b6fffffffffffffffffffffffffffffffff91909116815260200190565b73ffffffffffffffffffffffffffffffffffffffff9290921682526fffffffffffffffffffffffffffffffff16602082015260400190565b90815260200190565b91825273ffffffffffffffffffffffffffffffffffffffff16602082015260400190565b92835273ffffffffffffffffffffffffffffffffffffffff9190911660208301526bffffffffffffffffffffffff16604082015260600190565b938452602084019290925273ffffffffffffffffffffffffffffffffffffffff166040830152606082015260800190565b60008083357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe1843603018112613985578283fd5b83018035915067ffffffffffffffff82111561399f578283fd5b6020019150368190038213156139b457600080fd5b9250929050565b60405181810167ffffffffffffffff811182821017156139d757fe5b604052919050565b600067ffffffffffffffff8211156139f357fe5b50601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01660200190565b60005b83811015613a3a578181015183820152602001613a22565b83811115613a49576000848401525b50505050565b73ffffffffffffffffffffffffffffffffffffffff81168114613a7157600080fd5b5056fea164736f6c6343000706000a",
  deployedBytecode: "0x6080604052600436106101295760003560e01c8063b02c43d0116100a5578063c45a015511610074578063e70b9e2711610059578063e70b9e271461034f578063f2d2909b1461036f578063f549ab421461038f57610129565b8063c45a01551461030c578063d953186e1461032157610129565b8063b02c43d01461026c578063b44a27221461029c578063b5ada6e4146102be578063c36c1ea5146102de57610129565b80633c423f0b116100fc5780635cc5e3d9116100e15780635cc5e3d9146101fd578063607777951461021d578063ac9650d81461024c57610129565b80633c423f0b146101c85780633dc0714b146101e857610129565b806301b754401461012e578063150b7a021461015957806326bfee04146101865780632f2d783d146101a8575b600080fd5b34801561013a57600080fd5b506101436103af565b60405161015091906138b9565b60405180910390f35b34801561016557600080fd5b5061017961017436600461273f565b6103d3565b6040516101509190612db4565b34801561019257600080fd5b506101a66101a1366004612a9c565b61071c565b005b3480156101b457600080fd5b506101436101c3366004612946565b61084a565b3480156101d457600080fd5b506101a66101e3366004612ac0565b610928565b3480156101f457600080fd5b50610143610bbb565b34801561020957600080fd5b506101a6610218366004612a72565b610bdf565b34801561022957600080fd5b5061023d6102383660046128f6565b610e10565b604051610150939291906138e6565b61025f61025a3660046127d9565b610e67565b6040516101509190612d36565b34801561027857600080fd5b5061028c6102873660046128f6565b610fc1565b6040516101509493929190612cf5565b3480156102a857600080fd5b506102b1611053565b6040516101509190612de1565b3480156102ca57600080fd5b506101436102d9366004612a57565b611077565b3480156102ea57600080fd5b506102fe6102f9366004612b52565b6111c5565b604051610150929190613881565b34801561031857600080fd5b506102b161124a565b34801561032d57600080fd5b5061034161033c366004612a72565b61126e565b6040516101509291906138c2565b34801561035b57600080fd5b5061014361036a36600461290e565b611493565b34801561037b57600080fd5b506101a661038a366004612a72565b6114b0565b34801561039b57600080fd5b506101a66103aa366004612a72565b61151b565b7f000000000000000000000000000000000000000000000000000000000000000081565b60003373ffffffffffffffffffffffffffffffffffffffff7f0000000000000000000000000000000000000000000000000000000000000000161461044d576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104449061375a565b60405180910390fd5b6000807f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166399fbab88876040518263ffffffff1660e01b81526004016104a991906138b9565b6101806040518083038186803b1580156104c257600080fd5b505afa1580156104d6573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906104fa9190612b73565b505050505096509650505050505060405180608001604052808873ffffffffffffffffffffffffffffffffffffffff168152602001600065ffffffffffff1681526020018360020b81526020018260020b8152506001600088815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160000160146101000a81548165ffffffffffff021916908365ffffffffffff160217905550604082015181600001601a6101000a81548162ffffff021916908360020b62ffffff160217905550606082015181600001601d6101000a81548162ffffff021916908360020b62ffffff1602179055509050508673ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff16877fcdfc765b85e1048bee3c6a0f9d1c91fc7c4631f5fe5745a55fc6843db5c3260f60405160405180910390a483156106ef5760a08414156106ab576106a66106a085870187612a57565b87611964565b6106ef565b60006106b985870187612848565b905060005b81518110156106ec576106e48282815181106106d657fe5b602002602001015189611964565b6001016106be565b50505b507f150b7a0200000000000000000000000000000000000000000000000000000000979650505050505050565b73ffffffffffffffffffffffffffffffffffffffff8116610769576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613183565b60008281526001602052604090205473ffffffffffffffffffffffffffffffffffffffff163381146107c7576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490612e86565b60008381526001602052604080822080547fffffffffffffffffffffffff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff868116918217909255915191929084169186917fcdfc765b85e1048bee3c6a0f9d1c91fc7c4631f5fe5745a55fc6843db5c3260f91a4505050565b73ffffffffffffffffffffffffffffffffffffffff83166000908152600360209081526040808320338452909152902054811580159061088957508082105b156108915750805b73ffffffffffffffffffffffffffffffffffffffff841660009081526003602090815260408083203384529091529020805482900390556108d3848483611ed1565b8273ffffffffffffffffffffffffffffffffffffffff167f106f923f993c2149d49b4255ff723acafa1f2d94393f561d3eda32ae348f72418260405161091991906138b9565b60405180910390a29392505050565b73ffffffffffffffffffffffffffffffffffffffff8216301415610978576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906137b7565b6000838152600160209081526040918290208251608081018452905473ffffffffffffffffffffffffffffffffffffffff8116825265ffffffffffff740100000000000000000000000000000000000000008204169282018390527a0100000000000000000000000000000000000000000000000000008104600290810b810b810b948301949094527d0100000000000000000000000000000000000000000000000000000000009004830b830b90920b606083015215610a65576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613046565b805173ffffffffffffffffffffffffffffffffffffffff163314610ab5576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613481565b6000848152600160205260408082208290558251905173ffffffffffffffffffffffffffffffffffffffff9091169086907fcdfc765b85e1048bee3c6a0f9d1c91fc7c4631f5fe5745a55fc6843db5c3260f908490a46040517fb88d4fde00000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff7f0000000000000000000000000000000000000000000000000000000000000000169063b88d4fde90610b83903090879089908890600401612cac565b600060405180830381600087803b158015610b9d57600080fd5b505af1158015610bb1573d6000803e3d6000fd5b5050505050505050565b7f000000000000000000000000000000000000000000000000000000000000000081565b60008111610c19576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906135be565b8160400151421115610c57576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906131e0565b7f0000000000000000000000000000000000000000000000000000000000000000428360400151031115610cb7576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104449061361b565b8160600151826040015110610cf8576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906136d7565b7f000000000000000000000000000000000000000000000000000000000000000082604001518360600151031115610d5c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613679565b6000610d67836120ad565b60008181526020819052604090208054840190558351909150610d8c903330856120de565b826020015173ffffffffffffffffffffffffffffffffffffffff16836000015173ffffffffffffffffffffffffffffffffffffffff167fa876344e28d4b5191ad03bc0d43f740e3695827ab0faccac739930b915ef8b0285604001518660600151876080015187604051610e039493929190613920565b60405180910390a3505050565b6000602081905290815260409020805460019091015473ffffffffffffffffffffffffffffffffffffffff8116907401000000000000000000000000000000000000000090046bffffffffffffffffffffffff1683565b60608167ffffffffffffffff81118015610e8057600080fd5b50604051908082528060200260200182016040528015610eb457816020015b6060815260200190600190039081610e9f5790505b50905060005b82811015610fba5760008030868685818110610ed257fe5b9050602002810190610ee49190613951565b604051610ef2929190612c9c565b600060405180830381855af49150503d8060008114610f2d576040519150601f19603f3d011682016040523d82523d6000602084013e610f32565b606091505b509150915081610f9857604481511015610f4b57600080fd5b60048101905080806020019051810190610f6591906129df565b6040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104449190612e16565b80848481518110610fa557fe5b60209081029190910101525050600101610eba565b5092915050565b60016020526000908152604090205473ffffffffffffffffffffffffffffffffffffffff81169065ffffffffffff74010000000000000000000000000000000000000000820416907a0100000000000000000000000000000000000000000000000000008104600290810b917d0100000000000000000000000000000000000000000000000000000000009004900b84565b7f000000000000000000000000000000000000000000000000000000000000000081565b600081606001514210156110b7576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490612f66565b60006110c2836120ad565b6000818152602081905260409020805493509091508261110e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490612e29565b60018101547401000000000000000000000000000000000000000090046bffffffffffffffffffffffff1615611170576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906134de565b6000815583516080850151611186919085611ed1565b817f65124e6175aa9904f40735e87e2a37c76e87a609b855287bb4d1aba8257d9763846040516111b691906138b9565b60405180910390a25050919050565b60008281526002602090815260408083208484529091529020805473ffffffffffffffffffffffffffffffffffffffff8116916bffffffffffffffffffffffff740100000000000000000000000000000000000000009092048216918214156112425760018101546fffffffffffffffffffffffffffffffff1691505b509250929050565b7f000000000000000000000000000000000000000000000000000000000000000081565b600080600061127c856120ad565b905060008061128b86846111c5565b915091506000816fffffffffffffffffffffffffffffffff16116112db576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490612f09565b60008681526001602081815260408084208151608081018352905473ffffffffffffffffffffffffffffffffffffffff80821683527401000000000000000000000000000000000000000080830465ffffffffffff16848701527a0100000000000000000000000000000000000000000000000000008304600290810b810b810b8587019081527d010000000000000000000000000000000000000000000000000000000000909404810b810b900b60608086019182528c8a52898852868a2087519182018852805482529098015480841689890152919091046bffffffffffffffffffffffff1687860152948e01519151945193517fa38807f200000000000000000000000000000000000000000000000000000000815292969491169263a38807f29261140e929190600401612e02565b60606040518083038186803b15801561142657600080fd5b505afa15801561143a573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061145e9190612986565b50915050611482826000015183602001518c604001518d60600151888a87426122c3565b909b909a5098505050505050505050565b600360209081526000928352604080842090915290825290205481565b60008181526001602052604090205473ffffffffffffffffffffffffffffffffffffffff16331461150d576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613561565b6115178282611964565b5050565b6000818152600160209081526040918290208251608081018452905473ffffffffffffffffffffffffffffffffffffffff8116825265ffffffffffff74010000000000000000000000000000000000000000820416928201929092527a0100000000000000000000000000000000000000000000000000008204600290810b810b810b938201939093527d010000000000000000000000000000000000000000000000000000000000909104820b820b90910b60608083019190915283015142101561163157805173ffffffffffffffffffffffffffffffffffffffff163314611631576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104449061331e565b600061163c846120ad565b905060008061164b85846111c5565b91509150806fffffffffffffffffffffffffffffffff166000141561169c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490612fe9565b600083815260208181526040808320888452600180845282852080547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff65ffffffffffff740100000000000000000000000000000000000000008084048216830190911681027fffffffffffff000000000000ffffffffffffffffffffffffffffffffffffffff9093169290921790925591830180546bffffffffffffffffffffffff848204811690930190921690920273ffffffffffffffffffffffffffffffffffffffff91821617909155928a01518883015160608a015193517fa38807f2000000000000000000000000000000000000000000000000000000008152929594919091169263a38807f2926117b7929190600401612e02565b60606040518083038186803b1580156117cf57600080fd5b505afa1580156117e3573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906118079190612986565b508354600185015460408c015160608d0151939550600094508493611848939273ffffffffffffffffffffffffffffffffffffffff169190898b89426122c3565b6001860180547fffffffffffffffffffffffff0000000000000000000000000000000000000000811673ffffffffffffffffffffffffffffffffffffffff9182168401821617909155865483900387558c51811660009081526003602090815260408083208e5190941683529281528282208054860190558d8252600281528282208c8352905290812090815591935091506bffffffffffffffffffffffff6fffffffffffffffffffffffffffffffff87161061192a576001810180547fffffffffffffffffffffffffffffffff000000000000000000000000000000001690555b60405188908b907fe1ba67e807ae0efa0a9549f9520ddc15c27f0a4dae2bc045e800ca66a940778f90600090a35050505050505050505050565b81604001514210156119a2576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906133a1565b816060015142106119df576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613126565b60006119ea836120ad565b600081815260208190526040902054909150611a32576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906132c1565b60008281526002602090815260408083208484529091529020547401000000000000000000000000000000000000000090046bffffffffffffffffffffffff1615611aa9576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906130c9565b600080600080611afa7f00000000000000000000000000000000000000000000000000000000000000007f000000000000000000000000000000000000000000000000000000000000000088612345565b9350935093509350866020015173ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1614611b6b576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610444906133fe565b6000816fffffffffffffffffffffffffffffffff1611611bb7576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161044490613263565b6000868152600160208181526040808420805465ffffffffffff740100000000000000000000000000000000000000008083048216870190911681027fffffffffffff000000000000ffffffffffffffffffffffffffffffffffffffff9092169190911790915589855291849052808420830180546bffffffffffffffffffffffff848204811690950190941690920273ffffffffffffffffffffffffffffffffffffffff93841617909155517fa38807f20000000000000000000000000000000000000000000000000000000081529086169063a38807f290611ca19087908790600401612e02565b60606040518083038186803b158015611cb957600080fd5b505afa158015611ccd573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190611cf19190612986565b509150506bffffffffffffffffffffffff6fffffffffffffffffffffffffffffffff831610611e0a576040805160608101825273ffffffffffffffffffffffffffffffffffffffff80841682526bffffffffffffffffffffffff60208084018281526fffffffffffffffffffffffffffffffff80891686880190815260008f8152600285528881208f82529094529690922094518554915190931674010000000000000000000000000000000000000000029284167fffffffffffffffffffffffff000000000000000000000000000000000000000090911617909216178255915160019091018054919092167fffffffffffffffffffffffffffffffff00000000000000000000000000000000909116179055611e8e565b6000878152600260209081526040808320898452909152902080547fffffffffffffffffffffffff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff8381169190911716740100000000000000000000000000000000000000006bffffffffffffffffffffffff8516021790555b85877f3fe90ccd0a34e28f2b4b7a1e8323415ed9dd595f4eec5dfd461d18c2df336dbd84604051611ebf9190613864565b60405180910390a35050505050505050565b6040805173ffffffffffffffffffffffffffffffffffffffff8481166024830152604480830185905283518084039091018152606490920183526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167fa9059cbb000000000000000000000000000000000000000000000000000000001781529251825160009485949389169392918291908083835b60208310611fa657805182527fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe09092019160209182019101611f69565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d8060008114612008576040519150601f19603f3d011682016040523d82523d6000602084013e61200d565b606091505b509150915081801561203b57508051158061203b575080806020019051602081101561203857600080fd5b50515b6120a657604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600260248201527f5354000000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b5050505050565b6000816040516020016120c09190613814565b6040516020818303038152906040528051906020012090505b919050565b6040805173ffffffffffffffffffffffffffffffffffffffff85811660248301528481166044830152606480830185905283518084039091018152608490920183526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167f23b872dd00000000000000000000000000000000000000000000000000000000178152925182516000948594938a169392918291908083835b602083106121bb57805182527fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0909201916020918201910161217e565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d806000811461221d576040519150601f19603f3d011682016040523d82523d6000602084013e612222565b606091505b5091509150818015612250575080511580612250575080806020019051602081101561224d57600080fd5b50515b6122bb57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600360248201527f5354460000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b505050505050565b600080878310156122d057fe5b508383036fffffffffffffffffffffffffffffffff861602600073ffffffffffffffffffffffffffffffffffffffff8a1660808a61230e8b8861244e565b03901b0390506123358b8373ffffffffffffffffffffffffffffffffffffffff1683612467565b9250509850989650505050505050565b60008060008060008060008873ffffffffffffffffffffffffffffffffffffffff166399fbab88896040518263ffffffff1660e01b8152600401808281526020019150506101806040518083038186803b1580156123a257600080fd5b505afa1580156123b6573d6000803e3d6000fd5b505050506040513d6101808110156123cd57600080fd5b50604080820151606080840151608085015160a086015160c087015160e0909701518651948501875273ffffffffffffffffffffffffffffffffffffffff80871686528416602086015262ffffff8316968501969096529b50949950929750909550909350909150612440908b90612534565b965050505093509350935093565b60008183101561245e5781612460565b825b9392505050565b600080807fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff858709868602925082811090839003039050806124bb57600084116124b057600080fd5b508290049050612460565b8084116124c757600080fd5b6000848688096000868103871696879004966002600389028118808a02820302808a02820302808a02820302808a02820302808a02820302808a02909103029181900381900460010186841190950394909402919094039290920491909117919091029150509392505050565b6000816020015173ffffffffffffffffffffffffffffffffffffffff16826000015173ffffffffffffffffffffffffffffffffffffffff161061257657600080fd5b508051602080830151604093840151845173ffffffffffffffffffffffffffffffffffffffff94851681850152939091168385015262ffffff166060808401919091528351808403820181526080840185528051908301207fff0000000000000000000000000000000000000000000000000000000000000060a085015294901b7fffffffffffffffffffffffffffffffffffffffff0000000000000000000000001660a183015260b58201939093527fe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b5460d5808301919091528251808303909101815260f5909101909152805191012090565b80516120d981613a4f565b8051600281900b81146120d957600080fd5b600060a08284031215612698578081fd5b60405160a0810181811067ffffffffffffffff821117156126b557fe5b60405290508082356126c681613a4f565b815260208301356126d681613a4f565b80602083015250604083013560408201526060830135606082015260808301356126ff81613a4f565b6080919091015292915050565b80516fffffffffffffffffffffffffffffffff811681146120d957600080fd5b805162ffffff811681146120d957600080fd5b600080600080600060808688031215612756578081fd5b853561276181613a4f565b9450602086013561277181613a4f565b935060408601359250606086013567ffffffffffffffff80821115612794578283fd5b818801915088601f8301126127a7578283fd5b8135818111156127b5578384fd5b8960208285010111156127c6578384fd5b9699959850939650602001949392505050565b600080602083850312156127eb578182fd5b823567ffffffffffffffff80821115612802578384fd5b818501915085601f830112612815578384fd5b813581811115612823578485fd5b8660208083028501011115612836578485fd5b60209290920196919550909350505050565b6000602080838503121561285a578182fd5b823567ffffffffffffffff80821115612871578384fd5b818501915085601f830112612884578384fd5b81358181111561289057fe5b61289d84858302016139bb565b818152848101925083850160a0808402860187018a10156128bc578788fd5b8795505b838610156128e8576128d28a83612687565b85526001959095019493860193908101906128c0565b509098975050505050505050565b600060208284031215612907578081fd5b5035919050565b60008060408385031215612920578182fd5b823561292b81613a4f565b9150602083013561293b81613a4f565b809150509250929050565b60008060006060848603121561295a578081fd5b833561296581613a4f565b9250602084013561297581613a4f565b929592945050506040919091013590565b60008060006060848603121561299a578081fd5b83518060060b81146129aa578182fd5b60208501519093506129bb81613a4f565b604085015190925063ffffffff811681146129d4578182fd5b809150509250925092565b6000602082840312156129f0578081fd5b815167ffffffffffffffff811115612a06578182fd5b8201601f81018413612a16578182fd5b8051612a29612a24826139df565b6139bb565b818152856020838501011115612a3d578384fd5b612a4e826020830160208601613a1f565b95945050505050565b600060a08284031215612a68578081fd5b6124608383612687565b60008060c08385031215612a84578182fd5b612a8e8484612687565b9460a0939093013593505050565b60008060408385031215612aae578182fd5b82359150602083013561293b81613a4f565b600080600060608486031215612ad4578081fd5b833592506020840135612ae681613a4f565b9150604084013567ffffffffffffffff811115612b01578182fd5b8401601f81018613612b11578182fd5b8035612b1f612a24826139df565b818152876020838501011115612b33578384fd5b8160208401602083013783602083830101528093505050509250925092565b60008060408385031215612b64578182fd5b50508035926020909101359150565b6000806000806000806000806000806000806101808d8f031215612b9557898afd5b8c516bffffffffffffffffffffffff81168114612bb0578a8bfd5b9b50612bbe60208e0161266a565b9a50612bcc60408e0161266a565b9950612bda60608e0161266a565b9850612be860808e0161272c565b9750612bf660a08e01612675565b9650612c0460c08e01612675565b9550612c1260e08e0161270c565b94506101008d015193506101208d01519250612c316101408e0161270c565b9150612c406101608e0161270c565b90509295989b509295989b509295989b565b60008151808452612c6a816020860160208601613a1f565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b6000828483379101908152919050565b600073ffffffffffffffffffffffffffffffffffffffff808716835280861660208401525083604083015260806060830152612ceb6080830184612c52565b9695505050505050565b73ffffffffffffffffffffffffffffffffffffffff94909416845265ffffffffffff929092166020840152600290810b60408401520b606082015260800190565b6000602080830181845280855180835260408601915060408482028701019250838701855b82811015612da7577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc0888603018452612d95858351612c52565b94509285019290850190600101612d5b565b5092979650505050505050565b7fffffffff0000000000000000000000000000000000000000000000000000000091909116815260200190565b73ffffffffffffffffffffffffffffffffffffffff91909116815260200190565b600292830b8152910b602082015260400190565b6000602082526124606020830184612c52565b60208082526032908201527f556e697377617056335374616b65723a3a656e64496e63656e746976653a206e60408201527f6f20726566756e6420617661696c61626c650000000000000000000000000000606082015260800190565b60208082526045908201527f556e697377617056335374616b65723a3a7472616e736665724465706f73697460408201527f3a2063616e206f6e6c792062652063616c6c6564206279206465706f7369742060608201527f6f776e6572000000000000000000000000000000000000000000000000000000608082015260a00190565b60208082526034908201527f556e697377617056335374616b65723a3a676574526577617264496e666f3a2060408201527f7374616b6520646f6573206e6f74206578697374000000000000000000000000606082015260800190565b60208082526043908201527f556e697377617056335374616b65723a3a656e64496e63656e746976653a206360408201527f616e6e6f7420656e6420696e63656e74697665206265666f726520656e64207460608201527f696d650000000000000000000000000000000000000000000000000000000000608082015260a00190565b60208082526033908201527f556e697377617056335374616b65723a3a756e7374616b65546f6b656e3a207360408201527f74616b6520646f6573206e6f7420657869737400000000000000000000000000606082015260800190565b60208082526042908201527f556e697377617056335374616b65723a3a7769746864726177546f6b656e3a2060408201527f63616e6e6f7420776974686472617720746f6b656e207768696c65207374616b60608201527f6564000000000000000000000000000000000000000000000000000000000000608082015260a00190565b60208082526031908201527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a20746f6b60408201527f656e20616c7265616479207374616b6564000000000000000000000000000000606082015260800190565b6020808252602c908201527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a20696e6360408201527f656e7469766520656e6465640000000000000000000000000000000000000000606082015260800190565b6020808252603c908201527f556e697377617056335374616b65723a3a7472616e736665724465706f73697460408201527f3a20696e76616c6964207472616e7366657220726563697069656e7400000000606082015260800190565b60208082526049908201527f556e697377617056335374616b65723a3a637265617465496e63656e7469766560408201527f3a2073746172742074696d65206d757374206265206e6f77206f7220696e207460608201527f6865206675747572650000000000000000000000000000000000000000000000608082015260a00190565b602080825260409082018190527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a2063616e908201527f6e6f74207374616b6520746f6b656e20776974682030206c6971756964697479606082015260800190565b60208082526033908201527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a206e6f6e60408201527f2d6578697374656e7420696e63656e7469766500000000000000000000000000606082015260800190565b60208082526056908201527f556e697377617056335374616b65723a3a756e7374616b65546f6b656e3a206f60408201527f6e6c79206f776e65722063616e20776974686472617720746f6b656e2062656660608201527f6f726520696e63656e7469766520656e642074696d6500000000000000000000608082015260a00190565b60208082526032908201527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a20696e6360408201527f656e74697665206e6f7420737461727465640000000000000000000000000000606082015260800190565b60208082526041908201527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a20746f6b60408201527f656e20706f6f6c206973206e6f742074686520696e63656e7469766520706f6f60608201527f6c00000000000000000000000000000000000000000000000000000000000000608082015260a00190565b6020808252603d908201527f556e697377617056335374616b65723a3a7769746864726177546f6b656e3a2060408201527f6f6e6c79206f776e65722063616e20776974686472617720746f6b656e000000606082015260800190565b6020808252604d908201527f556e697377617056335374616b65723a3a656e64496e63656e746976653a206360408201527f616e6e6f7420656e6420696e63656e74697665207768696c65206465706f736960608201527f747320617265207374616b656400000000000000000000000000000000000000608082015260a00190565b60208082526037908201527f556e697377617056335374616b65723a3a7374616b65546f6b656e3a206f6e6c60408201527f79206f776e65722063616e207374616b6520746f6b656e000000000000000000606082015260800190565b60208082526039908201527f556e697377617056335374616b65723a3a637265617465496e63656e7469766560408201527f3a20726577617264206d75737420626520706f73697469766500000000000000606082015260800190565b602080825260409082018190527f556e697377617056335374616b65723a3a637265617465496e63656e74697665908201527f3a2073746172742074696d6520746f6f2066617220696e746f20667574757265606082015260800190565b602080825260409082018190527f556e697377617056335374616b65723a3a637265617465496e63656e74697665908201527f3a20696e63656e74697665206475726174696f6e20697320746f6f206c6f6e67606082015260800190565b60208082526044908201527f556e697377617056335374616b65723a3a637265617465496e63656e7469766560408201527f3a2073746172742074696d65206d757374206265206265666f726520656e642060608201527f74696d6500000000000000000000000000000000000000000000000000000000608082015260a00190565b60208082526032908201527f556e697377617056335374616b65723a3a6f6e4552433732315265636569766560408201527f643a206e6f74206120756e697633206e66740000000000000000000000000000606082015260800190565b60208082526039908201527f556e697377617056335374616b65723a3a7769746864726177546f6b656e3a2060408201527f63616e6e6f7420776974686472617720746f207374616b657200000000000000606082015260800190565b815173ffffffffffffffffffffffffffffffffffffffff90811682526020808401518216908301526040808401519083015260608084015190830152608092830151169181019190915260a00190565b6fffffffffffffffffffffffffffffffff91909116815260200190565b73ffffffffffffffffffffffffffffffffffffffff9290921682526fffffffffffffffffffffffffffffffff16602082015260400190565b90815260200190565b91825273ffffffffffffffffffffffffffffffffffffffff16602082015260400190565b92835273ffffffffffffffffffffffffffffffffffffffff9190911660208301526bffffffffffffffffffffffff16604082015260600190565b938452602084019290925273ffffffffffffffffffffffffffffffffffffffff166040830152606082015260800190565b60008083357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe1843603018112613985578283fd5b83018035915067ffffffffffffffff82111561399f578283fd5b6020019150368190038213156139b457600080fd5b9250929050565b60405181810167ffffffffffffffff811182821017156139d757fe5b604052919050565b600067ffffffffffffffff8211156139f357fe5b50601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01660200190565b60005b83811015613a3a578181015183820152602001613a22565b83811115613a49576000848401525b50505050565b73ffffffffffffffffffffffffffffffffffffffff81168114613a7157600080fd5b5056fea164736f6c6343000706000a",
  linkReferences: {},
  deployedLinkReferences: {}
};

// ../../node_modules/@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json
var SwapRouter_default = {
  _format: "hh-sol-artifact-1",
  contractName: "SwapRouter",
  sourceName: "contracts/SwapRouter.sol",
  abi: [
    {
      inputs: [
        {
          internalType: "address",
          name: "_factory",
          type: "address"
        },
        {
          internalType: "address",
          name: "_WETH9",
          type: "address"
        }
      ],
      stateMutability: "nonpayable",
      type: "constructor"
    },
    {
      inputs: [],
      name: "WETH9",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "bytes",
              name: "path",
              type: "bytes"
            },
            {
              internalType: "address",
              name: "recipient",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "deadline",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amountIn",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amountOutMinimum",
              type: "uint256"
            }
          ],
          internalType: "struct ISwapRouter.ExactInputParams",
          name: "params",
          type: "tuple"
        }
      ],
      name: "exactInput",
      outputs: [
        {
          internalType: "uint256",
          name: "amountOut",
          type: "uint256"
        }
      ],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "address",
              name: "tokenIn",
              type: "address"
            },
            {
              internalType: "address",
              name: "tokenOut",
              type: "address"
            },
            {
              internalType: "uint24",
              name: "fee",
              type: "uint24"
            },
            {
              internalType: "address",
              name: "recipient",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "deadline",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amountIn",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amountOutMinimum",
              type: "uint256"
            },
            {
              internalType: "uint160",
              name: "sqrtPriceLimitX96",
              type: "uint160"
            }
          ],
          internalType: "struct ISwapRouter.ExactInputSingleParams",
          name: "params",
          type: "tuple"
        }
      ],
      name: "exactInputSingle",
      outputs: [
        {
          internalType: "uint256",
          name: "amountOut",
          type: "uint256"
        }
      ],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "bytes",
              name: "path",
              type: "bytes"
            },
            {
              internalType: "address",
              name: "recipient",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "deadline",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amountOut",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amountInMaximum",
              type: "uint256"
            }
          ],
          internalType: "struct ISwapRouter.ExactOutputParams",
          name: "params",
          type: "tuple"
        }
      ],
      name: "exactOutput",
      outputs: [
        {
          internalType: "uint256",
          name: "amountIn",
          type: "uint256"
        }
      ],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "address",
              name: "tokenIn",
              type: "address"
            },
            {
              internalType: "address",
              name: "tokenOut",
              type: "address"
            },
            {
              internalType: "uint24",
              name: "fee",
              type: "uint24"
            },
            {
              internalType: "address",
              name: "recipient",
              type: "address"
            },
            {
              internalType: "uint256",
              name: "deadline",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amountOut",
              type: "uint256"
            },
            {
              internalType: "uint256",
              name: "amountInMaximum",
              type: "uint256"
            },
            {
              internalType: "uint160",
              name: "sqrtPriceLimitX96",
              type: "uint160"
            }
          ],
          internalType: "struct ISwapRouter.ExactOutputSingleParams",
          name: "params",
          type: "tuple"
        }
      ],
      name: "exactOutputSingle",
      outputs: [
        {
          internalType: "uint256",
          name: "amountIn",
          type: "uint256"
        }
      ],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [],
      name: "factory",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address"
        }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "bytes[]",
          name: "data",
          type: "bytes[]"
        }
      ],
      name: "multicall",
      outputs: [
        {
          internalType: "bytes[]",
          name: "results",
          type: "bytes[]"
        }
      ],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [],
      name: "refundETH",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "deadline",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "selfPermit",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "nonce",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "expiry",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "selfPermitAllowed",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "nonce",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "expiry",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "selfPermitAllowedIfNecessary",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256"
        },
        {
          internalType: "uint256",
          name: "deadline",
          type: "uint256"
        },
        {
          internalType: "uint8",
          name: "v",
          type: "uint8"
        },
        {
          internalType: "bytes32",
          name: "r",
          type: "bytes32"
        },
        {
          internalType: "bytes32",
          name: "s",
          type: "bytes32"
        }
      ],
      name: "selfPermitIfNecessary",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "amountMinimum",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "recipient",
          type: "address"
        }
      ],
      name: "sweepToken",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "amountMinimum",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "recipient",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "feeBips",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "feeRecipient",
          type: "address"
        }
      ],
      name: "sweepTokenWithFee",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "int256",
          name: "amount0Delta",
          type: "int256"
        },
        {
          internalType: "int256",
          name: "amount1Delta",
          type: "int256"
        },
        {
          internalType: "bytes",
          name: "_data",
          type: "bytes"
        }
      ],
      name: "uniswapV3SwapCallback",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "amountMinimum",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "recipient",
          type: "address"
        }
      ],
      name: "unwrapWETH9",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "amountMinimum",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "recipient",
          type: "address"
        },
        {
          internalType: "uint256",
          name: "feeBips",
          type: "uint256"
        },
        {
          internalType: "address",
          name: "feeRecipient",
          type: "address"
        }
      ],
      name: "unwrapWETH9WithFee",
      outputs: [],
      stateMutability: "payable",
      type: "function"
    },
    {
      stateMutability: "payable",
      type: "receive"
    }
  ],
  bytecode: "0x60c06040526000196000553480156200001757600080fd5b506040516200302f3803806200302f8339810160408190526200003a9162000076565b6001600160601b0319606092831b8116608052911b1660a052620000ad565b80516001600160a01b03811681146200007157600080fd5b919050565b6000806040838503121562000089578182fd5b620000948362000059565b9150620000a46020840162000059565b90509250929050565b60805160601c60a05160601c612f26620001096000398061012f528061058352806106ad5280610747528061078752806108b15280611c435280611ca35280611d24525080610dc6528061140c5280611e265250612f266000f3fe6080604052600436106101125760003560e01c8063c04b8d59116100a5578063df2ab5bb11610074578063f28c049811610059578063f28c0498146102f5578063f3995c6714610308578063fa461e331461031b576101bd565b8063df2ab5bb146102cf578063e0e189a0146102e2576101bd565b8063c04b8d5914610281578063c2e3140a14610294578063c45a0155146102a7578063db3e2198146102bc576101bd565b80634aa4a4fc116100e15780634aa4a4fc146102195780639b2c0a371461023b578063a4a78f0c1461024e578063ac9650d814610261576101bd565b806312210e8a146101c2578063414bf389146101ca5780634659a494146101f357806349404b7c14610206576101bd565b366101bd573373ffffffffffffffffffffffffffffffffffffffff7f000000000000000000000000000000000000000000000000000000000000000016146101bb57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600960248201527f4e6f742057455448390000000000000000000000000000000000000000000000604482015290519081900360640190fd5b005b600080fd5b6101bb61033b565b6101dd6101d83660046129f8565b61034d565b6040516101ea9190612df1565b60405180910390f35b6101bb610201366004612776565b6104bf565b6101bb610214366004612aff565b61057f565b34801561022557600080fd5b5061022e610745565b6040516101ea9190612c37565b6101bb610249366004612b2e565b610769565b6101bb61025c366004612776565b610981565b61027461026f3660046127d6565b610a56565b6040516101ea9190612caa565b6101dd61028f36600461294d565b610bb0565b6101bb6102a2366004612776565b610d0f565b3480156102b357600080fd5b5061022e610dc4565b6101dd6102ca3660046129f8565b610de8565b6101bb6102dd3660046126d7565b610f78565b6101bb6102f0366004612718565b611095565b6101dd610303366004612a14565b6111fb565b6101bb610316366004612776565b61132f565b34801561032757600080fd5b506101bb610336366004612868565b6113c7565b471561034b5761034b334761150e565b565b600081608001358061035d61165c565b11156103ca57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b61047060a08401356103e260808601606087016126b4565b6103f3610100870160e088016126b4565b604080518082019091528061040b60208a018a6126b4565b61041b60608b0160408c01612adc565b61042b60408c0160208d016126b4565b60405160200161043d93929190612bc1565b60405160208183030381529060405281526020013373ffffffffffffffffffffffffffffffffffffffff16815250611660565b91508260c001358210156104b9576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104b090612d72565b60405180910390fd5b50919050565b604080517f8fcbaf0c00000000000000000000000000000000000000000000000000000000815233600482015230602482015260448101879052606481018690526001608482015260ff851660a482015260c4810184905260e48101839052905173ffffffffffffffffffffffffffffffffffffffff881691638fcbaf0c9161010480830192600092919082900301818387803b15801561055f57600080fd5b505af1158015610573573d6000803e3d6000fd5b50505050505050505050565b60007f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060206040518083038186803b15801561060857600080fd5b505afa15801561061c573d6000803e3d6000fd5b505050506040513d602081101561063257600080fd5b50519050828110156106a557604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f496e73756666696369656e742057455448390000000000000000000000000000604482015290519081900360640190fd5b8015610740577f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff16632e1a7d4d826040518263ffffffff1660e01b815260040180828152602001915050600060405180830381600087803b15801561071e57600080fd5b505af1158015610732573d6000803e3d6000fd5b50505050610740828261150e565b505050565b7f000000000000000000000000000000000000000000000000000000000000000081565b60008211801561077a575060648211155b61078357600080fd5b60007f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060206040518083038186803b15801561080c57600080fd5b505afa158015610820573d6000803e3d6000fd5b505050506040513d602081101561083657600080fd5b50519050848110156108a957604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f496e73756666696369656e742057455448390000000000000000000000000000604482015290519081900360640190fd5b801561097a577f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff16632e1a7d4d826040518263ffffffff1660e01b815260040180828152602001915050600060405180830381600087803b15801561092257600080fd5b505af1158015610936573d6000803e3d6000fd5b50505050600061271061095285846117e690919063ffffffff16565b8161095957fe5b049050801561096c5761096c838261150e565b6109788582840361150e565b505b5050505050565b604080517fdd62ed3e00000000000000000000000000000000000000000000000000000000815233600482015230602482015290517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9173ffffffffffffffffffffffffffffffffffffffff89169163dd62ed3e91604480820192602092909190829003018186803b158015610a1657600080fd5b505afa158015610a2a573d6000803e3d6000fd5b505050506040513d6020811015610a4057600080fd5b50511015610978576109788686868686866104bf565b60608167ffffffffffffffff81118015610a6f57600080fd5b50604051908082528060200260200182016040528015610aa357816020015b6060815260200190600190039081610a8e5790505b50905060005b82811015610ba95760008030868685818110610ac157fe5b9050602002810190610ad39190612dfa565b604051610ae1929190612c27565b600060405180830381855af49150503d8060008114610b1c576040519150601f19603f3d011682016040523d82523d6000602084013e610b21565b606091505b509150915081610b8757604481511015610b3a57600080fd5b60048101905080806020019051810190610b5491906128e3565b6040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104b09190612d28565b80848481518110610b9457fe5b60209081029190910101525050600101610aa9565b5092915050565b6000816040015180610bc061165c565b1115610c2d57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b335b6000610c3e8560000151611810565b9050610c97856060015182610c57578660200151610c59565b305b60006040518060400160405280610c738b6000015161181c565b81526020018773ffffffffffffffffffffffffffffffffffffffff16815250611660565b60608601528015610cb7578451309250610cb09061182b565b8552610cc4565b8460600151935050610cca565b50610c2f565b8360800151831015610d08576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104b090612d72565b5050919050565b604080517fdd62ed3e0000000000000000000000000000000000000000000000000000000081523360048201523060248201529051869173ffffffffffffffffffffffffffffffffffffffff89169163dd62ed3e91604480820192602092909190829003018186803b158015610d8457600080fd5b505afa158015610d98573d6000803e3d6000fd5b505050506040513d6020811015610dae57600080fd5b505110156109785761097886868686868661132f565b7f000000000000000000000000000000000000000000000000000000000000000081565b6000816080013580610df861165c565b1115610e6557604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b610f0e60a0840135610e7d60808601606087016126b4565b610e8e610100870160e088016126b4565b6040518060400160405280886020016020810190610eac91906126b4565b610ebc60608b0160408c01612adc565b610ec960208c018c6126b4565b604051602001610edb93929190612bc1565b60405160208183030381529060405281526020013373ffffffffffffffffffffffffffffffffffffffff16815250611860565b91508260c00135821115610f4e576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104b090612d3b565b507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff600055919050565b60008373ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060206040518083038186803b158015610fe157600080fd5b505afa158015610ff5573d6000803e3d6000fd5b505050506040513d602081101561100b57600080fd5b505190508281101561107e57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f496e73756666696369656e7420746f6b656e0000000000000000000000000000604482015290519081900360640190fd5b801561108f5761108f848383611a1c565b50505050565b6000821180156110a6575060648211155b6110af57600080fd5b60008573ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060206040518083038186803b15801561111857600080fd5b505afa15801561112c573d6000803e3d6000fd5b505050506040513d602081101561114257600080fd5b50519050848110156111b557604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f496e73756666696369656e7420746f6b656e0000000000000000000000000000604482015290519081900360640190fd5b80156109785760006127106111ca83866117e6565b816111d157fe5b04905080156111e5576111e5878483611a1c565b6111f28786838503611a1c565b50505050505050565b600081604001358061120b61165c565b111561127857604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b6112eb606084013561129060408601602087016126b4565b60408051808201909152600090806112a88980612dfa565b8080601f01602080910402602001604051908101604052809392919081815260200183838082843760009201919091525050509082525033602090910152611860565b5060005491508260800135821115610f4e576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104b090612d3b565b604080517fd505accf000000000000000000000000000000000000000000000000000000008152336004820152306024820152604481018790526064810186905260ff8516608482015260a4810184905260c48101839052905173ffffffffffffffffffffffffffffffffffffffff88169163d505accf9160e480830192600092919082900301818387803b15801561055f57600080fd5b60008413806113d65750600083135b6113df57600080fd5b60006113ed82840184612a4c565b905060008060006114018460000151611bf1565b9250925092506114337f0000000000000000000000000000000000000000000000000000000000000000848484611c22565b5060008060008a13611474578473ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1610896114a5565b8373ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff16108a5b9150915081156114c4576114bf8587602001513384611c41565b610573565b85516114cf90611810565b156114f45785516114df9061182b565b86526114ee8133600089611860565b50610573565b806000819055508394506105738587602001513384611c41565b6040805160008082526020820190925273ffffffffffffffffffffffffffffffffffffffff84169083906040518082805190602001908083835b6020831061158557805182527fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe09092019160209182019101611548565b6001836020036101000a03801982511681845116808217855250505050505090500191505060006040518083038185875af1925050503d80600081146115e7576040519150601f19603f3d011682016040523d82523d6000602084013e6115ec565b606091505b505090508061074057604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600360248201527f5354450000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b4290565b600073ffffffffffffffffffffffffffffffffffffffff8416611681573093505b60008060006116938560000151611bf1565b9194509250905073ffffffffffffffffffffffffffffffffffffffff808316908416106000806116c4868686611e1f565b73ffffffffffffffffffffffffffffffffffffffff1663128acb088b856116ea8f611e5d565b73ffffffffffffffffffffffffffffffffffffffff8e161561170c578d611732565b8761172b5773fffd8963efd1fc6a506488495d951d5263988d25611732565b6401000276a45b8d6040516020016117439190612da9565b6040516020818303038152906040526040518663ffffffff1660e01b8152600401611772959493929190612c58565b6040805180830381600087803b15801561178b57600080fd5b505af115801561179f573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906117c39190612845565b91509150826117d257816117d4565b805b6000039b9a5050505050505050505050565b6000821580611801575050818102818382816117fe57fe5b04145b61180a57600080fd5b92915050565b8051604211155b919050565b606061180a826000602b611e8f565b805160609061180a9083906017907fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe901611e8f565b600073ffffffffffffffffffffffffffffffffffffffff8416611881573093505b60008060006118938560000151611bf1565b9194509250905073ffffffffffffffffffffffffffffffffffffffff808416908316106000806118c4858786611e1f565b73ffffffffffffffffffffffffffffffffffffffff1663128acb088b856118ea8f611e5d565b60000373ffffffffffffffffffffffffffffffffffffffff8e161561190f578d611935565b8761192e5773fffd8963efd1fc6a506488495d951d5263988d25611935565b6401000276a45b8d6040516020016119469190612da9565b6040516020818303038152906040526040518663ffffffff1660e01b8152600401611975959493929190612c58565b6040805180830381600087803b15801561198e57600080fd5b505af11580156119a2573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906119c69190612845565b915091506000836119db5781836000036119e1565b82826000035b909850905073ffffffffffffffffffffffffffffffffffffffff8a16611a0d578b8114611a0d57600080fd5b50505050505050949350505050565b6040805173ffffffffffffffffffffffffffffffffffffffff8481166024830152604480830185905283518084039091018152606490920183526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167fa9059cbb000000000000000000000000000000000000000000000000000000001781529251825160009485949389169392918291908083835b60208310611af157805182527fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe09092019160209182019101611ab4565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d8060008114611b53576040519150601f19603f3d011682016040523d82523d6000602084013e611b58565b606091505b5091509150818015611b86575080511580611b865750808060200190516020811015611b8357600080fd5b50515b61097a57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600260248201527f5354000000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b60008080611bff8482612076565b9250611c0c846014612176565b9050611c19846017612076565b91509193909250565b6000611c3885611c33868686612266565b6122e3565b95945050505050565b7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff16148015611c9c5750804710155b15611de5577f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff1663d0e30db0826040518263ffffffff1660e01b81526004016000604051808303818588803b158015611d0957600080fd5b505af1158015611d1d573d6000803e3d6000fd5b50505050507f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff1663a9059cbb83836040518363ffffffff1660e01b8152600401808373ffffffffffffffffffffffffffffffffffffffff16815260200182815260200192505050602060405180830381600087803b158015611db357600080fd5b505af1158015611dc7573d6000803e3d6000fd5b505050506040513d6020811015611ddd57600080fd5b5061108f9050565b73ffffffffffffffffffffffffffffffffffffffff8316301415611e1357611e0e848383611a1c565b61108f565b61108f84848484612313565b6000611e557f0000000000000000000000000000000000000000000000000000000000000000611e50868686612266565b6124f0565b949350505050565b60007f80000000000000000000000000000000000000000000000000000000000000008210611e8b57600080fd5b5090565b60608182601f011015611f0357604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600e60248201527f736c6963655f6f766572666c6f77000000000000000000000000000000000000604482015290519081900360640190fd5b828284011015611f7457604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600e60248201527f736c6963655f6f766572666c6f77000000000000000000000000000000000000604482015290519081900360640190fd5b81830184511015611fe657604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601160248201527f736c6963655f6f75744f66426f756e6473000000000000000000000000000000604482015290519081900360640190fd5b606082158015612005576040519150600082526020820160405261206d565b6040519150601f8416801560200281840101858101878315602002848b0101015b8183101561203e578051835260209283019201612026565b5050858452601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe016604052505b50949350505050565b6000818260140110156120ea57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f746f416464726573735f6f766572666c6f770000000000000000000000000000604482015290519081900360640190fd5b816014018351101561215d57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601560248201527f746f416464726573735f6f75744f66426f756e64730000000000000000000000604482015290519081900360640190fd5b5001602001516c01000000000000000000000000900490565b6000818260030110156121ea57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601160248201527f746f55696e7432345f6f766572666c6f77000000000000000000000000000000604482015290519081900360640190fd5b816003018351101561225d57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601460248201527f746f55696e7432345f6f75744f66426f756e6473000000000000000000000000604482015290519081900360640190fd5b50016003015190565b61226e612626565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1611156122a6579192915b506040805160608101825273ffffffffffffffffffffffffffffffffffffffff948516815292909316602083015262ffffff169181019190915290565b60006122ef83836124f0565b90503373ffffffffffffffffffffffffffffffffffffffff82161461180a57600080fd5b6040805173ffffffffffffffffffffffffffffffffffffffff85811660248301528481166044830152606480830185905283518084039091018152608490920183526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167f23b872dd00000000000000000000000000000000000000000000000000000000178152925182516000948594938a169392918291908083835b602083106123f057805182527fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe090920191602091820191016123b3565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d8060008114612452576040519150601f19603f3d011682016040523d82523d6000602084013e612457565b606091505b5091509150818015612485575080511580612485575080806020019051602081101561248257600080fd5b50515b61097857604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600360248201527f5354460000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b6000816020015173ffffffffffffffffffffffffffffffffffffffff16826000015173ffffffffffffffffffffffffffffffffffffffff161061253257600080fd5b508051602080830151604093840151845173ffffffffffffffffffffffffffffffffffffffff94851681850152939091168385015262ffffff166060808401919091528351808403820181526080840185528051908301207fff0000000000000000000000000000000000000000000000000000000000000060a085015294901b7fffffffffffffffffffffffffffffffffffffffff0000000000000000000000001660a183015260b58201939093527fe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b5460d5808301919091528251808303909101815260f5909101909152805191012090565b604080516060810182526000808252602082018190529181019190915290565b803561181781612ef4565b600082601f830112612661578081fd5b813561267461266f82612e88565b612e64565b818152846020838601011115612688578283fd5b816020850160208301379081016020019190915292915050565b600061010082840312156104b9578081fd5b6000602082840312156126c5578081fd5b81356126d081612ef4565b9392505050565b6000806000606084860312156126eb578182fd5b83356126f681612ef4565b925060208401359150604084013561270d81612ef4565b809150509250925092565b600080600080600060a0868803121561272f578081fd5b853561273a81612ef4565b945060208601359350604086013561275181612ef4565b925060608601359150608086013561276881612ef4565b809150509295509295909350565b60008060008060008060c0878903121561278e578081fd5b863561279981612ef4565b95506020870135945060408701359350606087013560ff811681146127bc578182fd5b9598949750929560808101359460a0909101359350915050565b600080602083850312156127e8578182fd5b823567ffffffffffffffff808211156127ff578384fd5b818501915085601f830112612812578384fd5b813581811115612820578485fd5b8660208083028501011115612833578485fd5b60209290920196919550909350505050565b60008060408385031215612857578182fd5b505080516020909101519092909150565b6000806000806060858703121561287d578182fd5b8435935060208501359250604085013567ffffffffffffffff808211156128a2578384fd5b818701915087601f8301126128b5578384fd5b8135818111156128c3578485fd5b8860208285010111156128d4578485fd5b95989497505060200194505050565b6000602082840312156128f4578081fd5b815167ffffffffffffffff81111561290a578182fd5b8201601f8101841361291a578182fd5b805161292861266f82612e88565b81815285602083850101111561293c578384fd5b611c38826020830160208601612ec8565b60006020828403121561295e578081fd5b813567ffffffffffffffff80821115612975578283fd5b9083019060a08286031215612988578283fd5b60405160a08101818110838211171561299d57fe5b6040528235828111156129ae578485fd5b6129ba87828601612651565b8252506129c960208401612646565b602082015260408301356040820152606083013560608201526080830135608082015280935050505092915050565b60006101008284031215612a0a578081fd5b6126d083836126a2565b600060208284031215612a25578081fd5b813567ffffffffffffffff811115612a3b578182fd5b820160a081850312156126d0578182fd5b600060208284031215612a5d578081fd5b813567ffffffffffffffff80821115612a74578283fd5b9083019060408286031215612a87578283fd5b604051604081018181108382111715612a9c57fe5b604052823582811115612aad578485fd5b612ab987828601612651565b82525060208301359250612acc83612ef4565b6020810192909252509392505050565b600060208284031215612aed578081fd5b813562ffffff811681146126d0578182fd5b60008060408385031215612b11578182fd5b823591506020830135612b2381612ef4565b809150509250929050565b60008060008060808587031215612b43578182fd5b843593506020850135612b5581612ef4565b9250604085013591506060850135612b6c81612ef4565b939692955090935050565b60008151808452612b8f816020860160208601612ec8565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b606093841b7fffffffffffffffffffffffffffffffffffffffff000000000000000000000000908116825260e89390931b7fffffff0000000000000000000000000000000000000000000000000000000000166014820152921b166017820152602b0190565b6000828483379101908152919050565b73ffffffffffffffffffffffffffffffffffffffff91909116815260200190565b600073ffffffffffffffffffffffffffffffffffffffff8088168352861515602084015285604084015280851660608401525060a06080830152612c9f60a0830184612b77565b979650505050505050565b6000602080830181845280855180835260408601915060408482028701019250838701855b82811015612d1b577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc0888603018452612d09858351612b77565b94509285019290850190600101612ccf565b5092979650505050505050565b6000602082526126d06020830184612b77565b60208082526012908201527f546f6f206d756368207265717565737465640000000000000000000000000000604082015260600190565b60208082526013908201527f546f6f206c6974746c6520726563656976656400000000000000000000000000604082015260600190565b600060208252825160406020840152612dc56060840182612b77565b905073ffffffffffffffffffffffffffffffffffffffff60208501511660408401528091505092915050565b90815260200190565b60008083357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe1843603018112612e2e578283fd5b83018035915067ffffffffffffffff821115612e48578283fd5b602001915036819003821315612e5d57600080fd5b9250929050565b60405181810167ffffffffffffffff81118282101715612e8057fe5b604052919050565b600067ffffffffffffffff821115612e9c57fe5b50601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01660200190565b60005b83811015612ee3578181015183820152602001612ecb565b8381111561108f5750506000910152565b73ffffffffffffffffffffffffffffffffffffffff81168114612f1657600080fd5b5056fea164736f6c6343000706000a",
  deployedBytecode: "0x6080604052600436106101125760003560e01c8063c04b8d59116100a5578063df2ab5bb11610074578063f28c049811610059578063f28c0498146102f5578063f3995c6714610308578063fa461e331461031b576101bd565b8063df2ab5bb146102cf578063e0e189a0146102e2576101bd565b8063c04b8d5914610281578063c2e3140a14610294578063c45a0155146102a7578063db3e2198146102bc576101bd565b80634aa4a4fc116100e15780634aa4a4fc146102195780639b2c0a371461023b578063a4a78f0c1461024e578063ac9650d814610261576101bd565b806312210e8a146101c2578063414bf389146101ca5780634659a494146101f357806349404b7c14610206576101bd565b366101bd573373ffffffffffffffffffffffffffffffffffffffff7f000000000000000000000000000000000000000000000000000000000000000016146101bb57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600960248201527f4e6f742057455448390000000000000000000000000000000000000000000000604482015290519081900360640190fd5b005b600080fd5b6101bb61033b565b6101dd6101d83660046129f8565b61034d565b6040516101ea9190612df1565b60405180910390f35b6101bb610201366004612776565b6104bf565b6101bb610214366004612aff565b61057f565b34801561022557600080fd5b5061022e610745565b6040516101ea9190612c37565b6101bb610249366004612b2e565b610769565b6101bb61025c366004612776565b610981565b61027461026f3660046127d6565b610a56565b6040516101ea9190612caa565b6101dd61028f36600461294d565b610bb0565b6101bb6102a2366004612776565b610d0f565b3480156102b357600080fd5b5061022e610dc4565b6101dd6102ca3660046129f8565b610de8565b6101bb6102dd3660046126d7565b610f78565b6101bb6102f0366004612718565b611095565b6101dd610303366004612a14565b6111fb565b6101bb610316366004612776565b61132f565b34801561032757600080fd5b506101bb610336366004612868565b6113c7565b471561034b5761034b334761150e565b565b600081608001358061035d61165c565b11156103ca57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b61047060a08401356103e260808601606087016126b4565b6103f3610100870160e088016126b4565b604080518082019091528061040b60208a018a6126b4565b61041b60608b0160408c01612adc565b61042b60408c0160208d016126b4565b60405160200161043d93929190612bc1565b60405160208183030381529060405281526020013373ffffffffffffffffffffffffffffffffffffffff16815250611660565b91508260c001358210156104b9576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104b090612d72565b60405180910390fd5b50919050565b604080517f8fcbaf0c00000000000000000000000000000000000000000000000000000000815233600482015230602482015260448101879052606481018690526001608482015260ff851660a482015260c4810184905260e48101839052905173ffffffffffffffffffffffffffffffffffffffff881691638fcbaf0c9161010480830192600092919082900301818387803b15801561055f57600080fd5b505af1158015610573573d6000803e3d6000fd5b50505050505050505050565b60007f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060206040518083038186803b15801561060857600080fd5b505afa15801561061c573d6000803e3d6000fd5b505050506040513d602081101561063257600080fd5b50519050828110156106a557604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f496e73756666696369656e742057455448390000000000000000000000000000604482015290519081900360640190fd5b8015610740577f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff16632e1a7d4d826040518263ffffffff1660e01b815260040180828152602001915050600060405180830381600087803b15801561071e57600080fd5b505af1158015610732573d6000803e3d6000fd5b50505050610740828261150e565b505050565b7f000000000000000000000000000000000000000000000000000000000000000081565b60008211801561077a575060648211155b61078357600080fd5b60007f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060206040518083038186803b15801561080c57600080fd5b505afa158015610820573d6000803e3d6000fd5b505050506040513d602081101561083657600080fd5b50519050848110156108a957604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f496e73756666696369656e742057455448390000000000000000000000000000604482015290519081900360640190fd5b801561097a577f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff16632e1a7d4d826040518263ffffffff1660e01b815260040180828152602001915050600060405180830381600087803b15801561092257600080fd5b505af1158015610936573d6000803e3d6000fd5b50505050600061271061095285846117e690919063ffffffff16565b8161095957fe5b049050801561096c5761096c838261150e565b6109788582840361150e565b505b5050505050565b604080517fdd62ed3e00000000000000000000000000000000000000000000000000000000815233600482015230602482015290517fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9173ffffffffffffffffffffffffffffffffffffffff89169163dd62ed3e91604480820192602092909190829003018186803b158015610a1657600080fd5b505afa158015610a2a573d6000803e3d6000fd5b505050506040513d6020811015610a4057600080fd5b50511015610978576109788686868686866104bf565b60608167ffffffffffffffff81118015610a6f57600080fd5b50604051908082528060200260200182016040528015610aa357816020015b6060815260200190600190039081610a8e5790505b50905060005b82811015610ba95760008030868685818110610ac157fe5b9050602002810190610ad39190612dfa565b604051610ae1929190612c27565b600060405180830381855af49150503d8060008114610b1c576040519150601f19603f3d011682016040523d82523d6000602084013e610b21565b606091505b509150915081610b8757604481511015610b3a57600080fd5b60048101905080806020019051810190610b5491906128e3565b6040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104b09190612d28565b80848481518110610b9457fe5b60209081029190910101525050600101610aa9565b5092915050565b6000816040015180610bc061165c565b1115610c2d57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b335b6000610c3e8560000151611810565b9050610c97856060015182610c57578660200151610c59565b305b60006040518060400160405280610c738b6000015161181c565b81526020018773ffffffffffffffffffffffffffffffffffffffff16815250611660565b60608601528015610cb7578451309250610cb09061182b565b8552610cc4565b8460600151935050610cca565b50610c2f565b8360800151831015610d08576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104b090612d72565b5050919050565b604080517fdd62ed3e0000000000000000000000000000000000000000000000000000000081523360048201523060248201529051869173ffffffffffffffffffffffffffffffffffffffff89169163dd62ed3e91604480820192602092909190829003018186803b158015610d8457600080fd5b505afa158015610d98573d6000803e3d6000fd5b505050506040513d6020811015610dae57600080fd5b505110156109785761097886868686868661132f565b7f000000000000000000000000000000000000000000000000000000000000000081565b6000816080013580610df861165c565b1115610e6557604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b610f0e60a0840135610e7d60808601606087016126b4565b610e8e610100870160e088016126b4565b6040518060400160405280886020016020810190610eac91906126b4565b610ebc60608b0160408c01612adc565b610ec960208c018c6126b4565b604051602001610edb93929190612bc1565b60405160208183030381529060405281526020013373ffffffffffffffffffffffffffffffffffffffff16815250611860565b91508260c00135821115610f4e576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104b090612d3b565b507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff600055919050565b60008373ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060206040518083038186803b158015610fe157600080fd5b505afa158015610ff5573d6000803e3d6000fd5b505050506040513d602081101561100b57600080fd5b505190508281101561107e57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f496e73756666696369656e7420746f6b656e0000000000000000000000000000604482015290519081900360640190fd5b801561108f5761108f848383611a1c565b50505050565b6000821180156110a6575060648211155b6110af57600080fd5b60008573ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401808273ffffffffffffffffffffffffffffffffffffffff16815260200191505060206040518083038186803b15801561111857600080fd5b505afa15801561112c573d6000803e3d6000fd5b505050506040513d602081101561114257600080fd5b50519050848110156111b557604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f496e73756666696369656e7420746f6b656e0000000000000000000000000000604482015290519081900360640190fd5b80156109785760006127106111ca83866117e6565b816111d157fe5b04905080156111e5576111e5878483611a1c565b6111f28786838503611a1c565b50505050505050565b600081604001358061120b61165c565b111561127857604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601360248201527f5472616e73616374696f6e20746f6f206f6c6400000000000000000000000000604482015290519081900360640190fd5b6112eb606084013561129060408601602087016126b4565b60408051808201909152600090806112a88980612dfa565b8080601f01602080910402602001604051908101604052809392919081815260200183838082843760009201919091525050509082525033602090910152611860565b5060005491508260800135821115610f4e576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104b090612d3b565b604080517fd505accf000000000000000000000000000000000000000000000000000000008152336004820152306024820152604481018790526064810186905260ff8516608482015260a4810184905260c48101839052905173ffffffffffffffffffffffffffffffffffffffff88169163d505accf9160e480830192600092919082900301818387803b15801561055f57600080fd5b60008413806113d65750600083135b6113df57600080fd5b60006113ed82840184612a4c565b905060008060006114018460000151611bf1565b9250925092506114337f0000000000000000000000000000000000000000000000000000000000000000848484611c22565b5060008060008a13611474578473ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1610896114a5565b8373ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff16108a5b9150915081156114c4576114bf8587602001513384611c41565b610573565b85516114cf90611810565b156114f45785516114df9061182b565b86526114ee8133600089611860565b50610573565b806000819055508394506105738587602001513384611c41565b6040805160008082526020820190925273ffffffffffffffffffffffffffffffffffffffff84169083906040518082805190602001908083835b6020831061158557805182527fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe09092019160209182019101611548565b6001836020036101000a03801982511681845116808217855250505050505090500191505060006040518083038185875af1925050503d80600081146115e7576040519150601f19603f3d011682016040523d82523d6000602084013e6115ec565b606091505b505090508061074057604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600360248201527f5354450000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b4290565b600073ffffffffffffffffffffffffffffffffffffffff8416611681573093505b60008060006116938560000151611bf1565b9194509250905073ffffffffffffffffffffffffffffffffffffffff808316908416106000806116c4868686611e1f565b73ffffffffffffffffffffffffffffffffffffffff1663128acb088b856116ea8f611e5d565b73ffffffffffffffffffffffffffffffffffffffff8e161561170c578d611732565b8761172b5773fffd8963efd1fc6a506488495d951d5263988d25611732565b6401000276a45b8d6040516020016117439190612da9565b6040516020818303038152906040526040518663ffffffff1660e01b8152600401611772959493929190612c58565b6040805180830381600087803b15801561178b57600080fd5b505af115801561179f573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906117c39190612845565b91509150826117d257816117d4565b805b6000039b9a5050505050505050505050565b6000821580611801575050818102818382816117fe57fe5b04145b61180a57600080fd5b92915050565b8051604211155b919050565b606061180a826000602b611e8f565b805160609061180a9083906017907fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe901611e8f565b600073ffffffffffffffffffffffffffffffffffffffff8416611881573093505b60008060006118938560000151611bf1565b9194509250905073ffffffffffffffffffffffffffffffffffffffff808416908316106000806118c4858786611e1f565b73ffffffffffffffffffffffffffffffffffffffff1663128acb088b856118ea8f611e5d565b60000373ffffffffffffffffffffffffffffffffffffffff8e161561190f578d611935565b8761192e5773fffd8963efd1fc6a506488495d951d5263988d25611935565b6401000276a45b8d6040516020016119469190612da9565b6040516020818303038152906040526040518663ffffffff1660e01b8152600401611975959493929190612c58565b6040805180830381600087803b15801561198e57600080fd5b505af11580156119a2573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906119c69190612845565b915091506000836119db5781836000036119e1565b82826000035b909850905073ffffffffffffffffffffffffffffffffffffffff8a16611a0d578b8114611a0d57600080fd5b50505050505050949350505050565b6040805173ffffffffffffffffffffffffffffffffffffffff8481166024830152604480830185905283518084039091018152606490920183526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167fa9059cbb000000000000000000000000000000000000000000000000000000001781529251825160009485949389169392918291908083835b60208310611af157805182527fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe09092019160209182019101611ab4565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d8060008114611b53576040519150601f19603f3d011682016040523d82523d6000602084013e611b58565b606091505b5091509150818015611b86575080511580611b865750808060200190516020811015611b8357600080fd5b50515b61097a57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600260248201527f5354000000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b60008080611bff8482612076565b9250611c0c846014612176565b9050611c19846017612076565b91509193909250565b6000611c3885611c33868686612266565b6122e3565b95945050505050565b7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff16148015611c9c5750804710155b15611de5577f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff1663d0e30db0826040518263ffffffff1660e01b81526004016000604051808303818588803b158015611d0957600080fd5b505af1158015611d1d573d6000803e3d6000fd5b50505050507f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff1663a9059cbb83836040518363ffffffff1660e01b8152600401808373ffffffffffffffffffffffffffffffffffffffff16815260200182815260200192505050602060405180830381600087803b158015611db357600080fd5b505af1158015611dc7573d6000803e3d6000fd5b505050506040513d6020811015611ddd57600080fd5b5061108f9050565b73ffffffffffffffffffffffffffffffffffffffff8316301415611e1357611e0e848383611a1c565b61108f565b61108f84848484612313565b6000611e557f0000000000000000000000000000000000000000000000000000000000000000611e50868686612266565b6124f0565b949350505050565b60007f80000000000000000000000000000000000000000000000000000000000000008210611e8b57600080fd5b5090565b60608182601f011015611f0357604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600e60248201527f736c6963655f6f766572666c6f77000000000000000000000000000000000000604482015290519081900360640190fd5b828284011015611f7457604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600e60248201527f736c6963655f6f766572666c6f77000000000000000000000000000000000000604482015290519081900360640190fd5b81830184511015611fe657604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601160248201527f736c6963655f6f75744f66426f756e6473000000000000000000000000000000604482015290519081900360640190fd5b606082158015612005576040519150600082526020820160405261206d565b6040519150601f8416801560200281840101858101878315602002848b0101015b8183101561203e578051835260209283019201612026565b5050858452601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe016604052505b50949350505050565b6000818260140110156120ea57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601260248201527f746f416464726573735f6f766572666c6f770000000000000000000000000000604482015290519081900360640190fd5b816014018351101561215d57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601560248201527f746f416464726573735f6f75744f66426f756e64730000000000000000000000604482015290519081900360640190fd5b5001602001516c01000000000000000000000000900490565b6000818260030110156121ea57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601160248201527f746f55696e7432345f6f766572666c6f77000000000000000000000000000000604482015290519081900360640190fd5b816003018351101561225d57604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601460248201527f746f55696e7432345f6f75744f66426f756e6473000000000000000000000000604482015290519081900360640190fd5b50016003015190565b61226e612626565b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1611156122a6579192915b506040805160608101825273ffffffffffffffffffffffffffffffffffffffff948516815292909316602083015262ffffff169181019190915290565b60006122ef83836124f0565b90503373ffffffffffffffffffffffffffffffffffffffff82161461180a57600080fd5b6040805173ffffffffffffffffffffffffffffffffffffffff85811660248301528481166044830152606480830185905283518084039091018152608490920183526020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167f23b872dd00000000000000000000000000000000000000000000000000000000178152925182516000948594938a169392918291908083835b602083106123f057805182527fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe090920191602091820191016123b3565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d8060008114612452576040519150601f19603f3d011682016040523d82523d6000602084013e612457565b606091505b5091509150818015612485575080511580612485575080806020019051602081101561248257600080fd5b50515b61097857604080517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152600360248201527f5354460000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b6000816020015173ffffffffffffffffffffffffffffffffffffffff16826000015173ffffffffffffffffffffffffffffffffffffffff161061253257600080fd5b508051602080830151604093840151845173ffffffffffffffffffffffffffffffffffffffff94851681850152939091168385015262ffffff166060808401919091528351808403820181526080840185528051908301207fff0000000000000000000000000000000000000000000000000000000000000060a085015294901b7fffffffffffffffffffffffffffffffffffffffff0000000000000000000000001660a183015260b58201939093527fe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b5460d5808301919091528251808303909101815260f5909101909152805191012090565b604080516060810182526000808252602082018190529181019190915290565b803561181781612ef4565b600082601f830112612661578081fd5b813561267461266f82612e88565b612e64565b818152846020838601011115612688578283fd5b816020850160208301379081016020019190915292915050565b600061010082840312156104b9578081fd5b6000602082840312156126c5578081fd5b81356126d081612ef4565b9392505050565b6000806000606084860312156126eb578182fd5b83356126f681612ef4565b925060208401359150604084013561270d81612ef4565b809150509250925092565b600080600080600060a0868803121561272f578081fd5b853561273a81612ef4565b945060208601359350604086013561275181612ef4565b925060608601359150608086013561276881612ef4565b809150509295509295909350565b60008060008060008060c0878903121561278e578081fd5b863561279981612ef4565b95506020870135945060408701359350606087013560ff811681146127bc578182fd5b9598949750929560808101359460a0909101359350915050565b600080602083850312156127e8578182fd5b823567ffffffffffffffff808211156127ff578384fd5b818501915085601f830112612812578384fd5b813581811115612820578485fd5b8660208083028501011115612833578485fd5b60209290920196919550909350505050565b60008060408385031215612857578182fd5b505080516020909101519092909150565b6000806000806060858703121561287d578182fd5b8435935060208501359250604085013567ffffffffffffffff808211156128a2578384fd5b818701915087601f8301126128b5578384fd5b8135818111156128c3578485fd5b8860208285010111156128d4578485fd5b95989497505060200194505050565b6000602082840312156128f4578081fd5b815167ffffffffffffffff81111561290a578182fd5b8201601f8101841361291a578182fd5b805161292861266f82612e88565b81815285602083850101111561293c578384fd5b611c38826020830160208601612ec8565b60006020828403121561295e578081fd5b813567ffffffffffffffff80821115612975578283fd5b9083019060a08286031215612988578283fd5b60405160a08101818110838211171561299d57fe5b6040528235828111156129ae578485fd5b6129ba87828601612651565b8252506129c960208401612646565b602082015260408301356040820152606083013560608201526080830135608082015280935050505092915050565b60006101008284031215612a0a578081fd5b6126d083836126a2565b600060208284031215612a25578081fd5b813567ffffffffffffffff811115612a3b578182fd5b820160a081850312156126d0578182fd5b600060208284031215612a5d578081fd5b813567ffffffffffffffff80821115612a74578283fd5b9083019060408286031215612a87578283fd5b604051604081018181108382111715612a9c57fe5b604052823582811115612aad578485fd5b612ab987828601612651565b82525060208301359250612acc83612ef4565b6020810192909252509392505050565b600060208284031215612aed578081fd5b813562ffffff811681146126d0578182fd5b60008060408385031215612b11578182fd5b823591506020830135612b2381612ef4565b809150509250929050565b60008060008060808587031215612b43578182fd5b843593506020850135612b5581612ef4565b9250604085013591506060850135612b6c81612ef4565b939692955090935050565b60008151808452612b8f816020860160208601612ec8565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b606093841b7fffffffffffffffffffffffffffffffffffffffff000000000000000000000000908116825260e89390931b7fffffff0000000000000000000000000000000000000000000000000000000000166014820152921b166017820152602b0190565b6000828483379101908152919050565b73ffffffffffffffffffffffffffffffffffffffff91909116815260200190565b600073ffffffffffffffffffffffffffffffffffffffff8088168352861515602084015285604084015280851660608401525060a06080830152612c9f60a0830184612b77565b979650505050505050565b6000602080830181845280855180835260408601915060408482028701019250838701855b82811015612d1b577fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc0888603018452612d09858351612b77565b94509285019290850190600101612ccf565b5092979650505050505050565b6000602082526126d06020830184612b77565b60208082526012908201527f546f6f206d756368207265717565737465640000000000000000000000000000604082015260600190565b60208082526013908201527f546f6f206c6974746c6520726563656976656400000000000000000000000000604082015260600190565b600060208252825160406020840152612dc56060840182612b77565b905073ffffffffffffffffffffffffffffffffffffffff60208501511660408401528091505092915050565b90815260200190565b60008083357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe1843603018112612e2e578283fd5b83018035915067ffffffffffffffff821115612e48578283fd5b602001915036819003821315612e5d57600080fd5b9250929050565b60405181810167ffffffffffffffff81118282101715612e8057fe5b604052919050565b600067ffffffffffffffff821115612e9c57fe5b50601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01660200190565b60005b83811015612ee3578181015183820152602001612ecb565b8381111561108f5750506000910152565b73ffffffffffffffffffffffffffffffffffffffff81168114612f1657600080fd5b5056fea164736f6c6343000706000a",
  linkReferences: {},
  deployedLinkReferences: {}
};

// ../../node_modules/@uniswap/v3-sdk/dist/v3-sdk.esm.js
function _regeneratorRuntime() {
  _regeneratorRuntime = function() {
    return e;
  };
  var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function(t2, e2, r2) {
    t2[e2] = r2.value;
  }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag";
  function define2(t2, e2, r2) {
    return Object.defineProperty(t2, e2, {
      value: r2,
      enumerable: true,
      configurable: true,
      writable: true
    }), t2[e2];
  }
  try {
    define2({}, "");
  } catch (t2) {
    define2 = function(t3, e2, r2) {
      return t3[e2] = r2;
    };
  }
  function wrap(t2, e2, r2, n2) {
    var i2 = e2 && e2.prototype instanceof Generator ? e2 : Generator, a2 = Object.create(i2.prototype), c2 = new Context(n2 || []);
    return o(a2, "_invoke", {
      value: makeInvokeMethod(t2, r2, c2)
    }), a2;
  }
  function tryCatch(t2, e2, r2) {
    try {
      return {
        type: "normal",
        arg: t2.call(e2, r2)
      };
    } catch (t3) {
      return {
        type: "throw",
        arg: t3
      };
    }
  }
  e.wrap = wrap;
  var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {};
  function Generator() {
  }
  function GeneratorFunction() {
  }
  function GeneratorFunctionPrototype() {
  }
  var p = {};
  define2(p, a, function() {
    return this;
  });
  var d = Object.getPrototypeOf, v = d && d(d(values([])));
  v && v !== r && n.call(v, a) && (p = v);
  var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p);
  function defineIteratorMethods(t2) {
    ["next", "throw", "return"].forEach(function(e2) {
      define2(t2, e2, function(t3) {
        return this._invoke(e2, t3);
      });
    });
  }
  function AsyncIterator(t2, e2) {
    function invoke(r3, o2, i2, a2) {
      var c2 = tryCatch(t2[r3], t2, o2);
      if ("throw" !== c2.type) {
        var u2 = c2.arg, h2 = u2.value;
        return h2 && "object" == typeof h2 && n.call(h2, "__await") ? e2.resolve(h2.__await).then(function(t3) {
          invoke("next", t3, i2, a2);
        }, function(t3) {
          invoke("throw", t3, i2, a2);
        }) : e2.resolve(h2).then(function(t3) {
          u2.value = t3, i2(u2);
        }, function(t3) {
          return invoke("throw", t3, i2, a2);
        });
      }
      a2(c2.arg);
    }
    var r2;
    o(this, "_invoke", {
      value: function(t3, n2) {
        function callInvokeWithMethodAndArg() {
          return new e2(function(e3, r3) {
            invoke(t3, n2, e3, r3);
          });
        }
        return r2 = r2 ? r2.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
      }
    });
  }
  function makeInvokeMethod(e2, r2, n2) {
    var o2 = h;
    return function(i2, a2) {
      if (o2 === f) throw new Error("Generator is already running");
      if (o2 === s) {
        if ("throw" === i2) throw a2;
        return {
          value: t,
          done: true
        };
      }
      for (n2.method = i2, n2.arg = a2; ; ) {
        var c2 = n2.delegate;
        if (c2) {
          var u2 = maybeInvokeDelegate(c2, n2);
          if (u2) {
            if (u2 === y) continue;
            return u2;
          }
        }
        if ("next" === n2.method) n2.sent = n2._sent = n2.arg;
        else if ("throw" === n2.method) {
          if (o2 === h) throw o2 = s, n2.arg;
          n2.dispatchException(n2.arg);
        } else "return" === n2.method && n2.abrupt("return", n2.arg);
        o2 = f;
        var p2 = tryCatch(e2, r2, n2);
        if ("normal" === p2.type) {
          if (o2 = n2.done ? s : l, p2.arg === y) continue;
          return {
            value: p2.arg,
            done: n2.done
          };
        }
        "throw" === p2.type && (o2 = s, n2.method = "throw", n2.arg = p2.arg);
      }
    };
  }
  function maybeInvokeDelegate(e2, r2) {
    var n2 = r2.method, o2 = e2.iterator[n2];
    if (o2 === t) return r2.delegate = null, "throw" === n2 && e2.iterator.return && (r2.method = "return", r2.arg = t, maybeInvokeDelegate(e2, r2), "throw" === r2.method) || "return" !== n2 && (r2.method = "throw", r2.arg = new TypeError("The iterator does not provide a '" + n2 + "' method")), y;
    var i2 = tryCatch(o2, e2.iterator, r2.arg);
    if ("throw" === i2.type) return r2.method = "throw", r2.arg = i2.arg, r2.delegate = null, y;
    var a2 = i2.arg;
    return a2 ? a2.done ? (r2[e2.resultName] = a2.value, r2.next = e2.nextLoc, "return" !== r2.method && (r2.method = "next", r2.arg = t), r2.delegate = null, y) : a2 : (r2.method = "throw", r2.arg = new TypeError("iterator result is not an object"), r2.delegate = null, y);
  }
  function pushTryEntry(t2) {
    var e2 = {
      tryLoc: t2[0]
    };
    1 in t2 && (e2.catchLoc = t2[1]), 2 in t2 && (e2.finallyLoc = t2[2], e2.afterLoc = t2[3]), this.tryEntries.push(e2);
  }
  function resetTryEntry(t2) {
    var e2 = t2.completion || {};
    e2.type = "normal", delete e2.arg, t2.completion = e2;
  }
  function Context(t2) {
    this.tryEntries = [{
      tryLoc: "root"
    }], t2.forEach(pushTryEntry, this), this.reset(true);
  }
  function values(e2) {
    if (e2 || "" === e2) {
      var r2 = e2[a];
      if (r2) return r2.call(e2);
      if ("function" == typeof e2.next) return e2;
      if (!isNaN(e2.length)) {
        var o2 = -1, i2 = function next() {
          for (; ++o2 < e2.length; ) if (n.call(e2, o2)) return next.value = e2[o2], next.done = false, next;
          return next.value = t, next.done = true, next;
        };
        return i2.next = i2;
      }
    }
    throw new TypeError(typeof e2 + " is not iterable");
  }
  return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", {
    value: GeneratorFunctionPrototype,
    configurable: true
  }), o(GeneratorFunctionPrototype, "constructor", {
    value: GeneratorFunction,
    configurable: true
  }), GeneratorFunction.displayName = define2(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function(t2) {
    var e2 = "function" == typeof t2 && t2.constructor;
    return !!e2 && (e2 === GeneratorFunction || "GeneratorFunction" === (e2.displayName || e2.name));
  }, e.mark = function(t2) {
    return Object.setPrototypeOf ? Object.setPrototypeOf(t2, GeneratorFunctionPrototype) : (t2.__proto__ = GeneratorFunctionPrototype, define2(t2, u, "GeneratorFunction")), t2.prototype = Object.create(g), t2;
  }, e.awrap = function(t2) {
    return {
      __await: t2
    };
  }, defineIteratorMethods(AsyncIterator.prototype), define2(AsyncIterator.prototype, c, function() {
    return this;
  }), e.AsyncIterator = AsyncIterator, e.async = function(t2, r2, n2, o2, i2) {
    void 0 === i2 && (i2 = Promise);
    var a2 = new AsyncIterator(wrap(t2, r2, n2, o2), i2);
    return e.isGeneratorFunction(r2) ? a2 : a2.next().then(function(t3) {
      return t3.done ? t3.value : a2.next();
    });
  }, defineIteratorMethods(g), define2(g, u, "Generator"), define2(g, a, function() {
    return this;
  }), define2(g, "toString", function() {
    return "[object Generator]";
  }), e.keys = function(t2) {
    var e2 = Object(t2), r2 = [];
    for (var n2 in e2) r2.push(n2);
    return r2.reverse(), function next() {
      for (; r2.length; ) {
        var t3 = r2.pop();
        if (t3 in e2) return next.value = t3, next.done = false, next;
      }
      return next.done = true, next;
    };
  }, e.values = values, Context.prototype = {
    constructor: Context,
    reset: function(e2) {
      if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = false, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e2) for (var r2 in this) "t" === r2.charAt(0) && n.call(this, r2) && !isNaN(+r2.slice(1)) && (this[r2] = t);
    },
    stop: function() {
      this.done = true;
      var t2 = this.tryEntries[0].completion;
      if ("throw" === t2.type) throw t2.arg;
      return this.rval;
    },
    dispatchException: function(e2) {
      if (this.done) throw e2;
      var r2 = this;
      function handle(n2, o3) {
        return a2.type = "throw", a2.arg = e2, r2.next = n2, o3 && (r2.method = "next", r2.arg = t), !!o3;
      }
      for (var o2 = this.tryEntries.length - 1; o2 >= 0; --o2) {
        var i2 = this.tryEntries[o2], a2 = i2.completion;
        if ("root" === i2.tryLoc) return handle("end");
        if (i2.tryLoc <= this.prev) {
          var c2 = n.call(i2, "catchLoc"), u2 = n.call(i2, "finallyLoc");
          if (c2 && u2) {
            if (this.prev < i2.catchLoc) return handle(i2.catchLoc, true);
            if (this.prev < i2.finallyLoc) return handle(i2.finallyLoc);
          } else if (c2) {
            if (this.prev < i2.catchLoc) return handle(i2.catchLoc, true);
          } else {
            if (!u2) throw new Error("try statement without catch or finally");
            if (this.prev < i2.finallyLoc) return handle(i2.finallyLoc);
          }
        }
      }
    },
    abrupt: function(t2, e2) {
      for (var r2 = this.tryEntries.length - 1; r2 >= 0; --r2) {
        var o2 = this.tryEntries[r2];
        if (o2.tryLoc <= this.prev && n.call(o2, "finallyLoc") && this.prev < o2.finallyLoc) {
          var i2 = o2;
          break;
        }
      }
      i2 && ("break" === t2 || "continue" === t2) && i2.tryLoc <= e2 && e2 <= i2.finallyLoc && (i2 = null);
      var a2 = i2 ? i2.completion : {};
      return a2.type = t2, a2.arg = e2, i2 ? (this.method = "next", this.next = i2.finallyLoc, y) : this.complete(a2);
    },
    complete: function(t2, e2) {
      if ("throw" === t2.type) throw t2.arg;
      return "break" === t2.type || "continue" === t2.type ? this.next = t2.arg : "return" === t2.type ? (this.rval = this.arg = t2.arg, this.method = "return", this.next = "end") : "normal" === t2.type && e2 && (this.next = e2), y;
    },
    finish: function(t2) {
      for (var e2 = this.tryEntries.length - 1; e2 >= 0; --e2) {
        var r2 = this.tryEntries[e2];
        if (r2.finallyLoc === t2) return this.complete(r2.completion, r2.afterLoc), resetTryEntry(r2), y;
      }
    },
    catch: function(t2) {
      for (var e2 = this.tryEntries.length - 1; e2 >= 0; --e2) {
        var r2 = this.tryEntries[e2];
        if (r2.tryLoc === t2) {
          var n2 = r2.completion;
          if ("throw" === n2.type) {
            var o2 = n2.arg;
            resetTryEntry(r2);
          }
          return o2;
        }
      }
      throw new Error("illegal catch attempt");
    },
    delegateYield: function(e2, r2, n2) {
      return this.delegate = {
        iterator: values(e2),
        resultName: r2,
        nextLoc: n2
      }, "next" === this.method && (this.arg = t), y;
    }
  }, e;
}
function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : String(i);
}
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  try {
    var info = gen[key](arg);
    var value = info.value;
  } catch (error) {
    reject(error);
    return;
  }
  if (info.done) {
    resolve(value);
  } else {
    Promise.resolve(value).then(_next, _throw);
  }
}
function _asyncToGenerator(fn) {
  return function() {
    var self2 = this, args = arguments;
    return new Promise(function(resolve, reject) {
      var gen = fn.apply(self2, args);
      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
      }
      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
      }
      _next(void 0);
    });
  };
}
function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor);
  }
}
function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  Object.defineProperty(Constructor, "prototype", {
    writable: false
  });
  return Constructor;
}
function _extends() {
  _extends = Object.assign ? Object.assign.bind() : function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  return _extends.apply(this, arguments);
}
function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;
  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }
  return target;
}
function _unsupportedIterableToArray(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return _arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
}
function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
  return arr2;
}
function _createForOfIteratorHelperLoose(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (it) return (it = it.call(o)).next.bind(it);
  if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
    if (it) o = it;
    var i = 0;
    return function() {
      if (i >= o.length) return {
        done: true
      };
      return {
        done: false,
        value: o[i++]
      };
    };
  }
  throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
var _TICK_SPACINGS;
var FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
var ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
var POOL_INIT_CODE_HASH = "0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54";
function poolInitCodeHash(chainId) {
  switch (chainId) {
    case ChainId.ZKSYNC:
      return "0x010013f177ea1fcbc4520f9a3ca7cd2d1d77959e05aa66484027cb38e712aeed";
    default:
      return POOL_INIT_CODE_HASH;
  }
}
var FeeAmount;
(function(FeeAmount2) {
  FeeAmount2[FeeAmount2["LOWEST"] = 100] = "LOWEST";
  FeeAmount2[FeeAmount2["LOW_200"] = 200] = "LOW_200";
  FeeAmount2[FeeAmount2["LOW_300"] = 300] = "LOW_300";
  FeeAmount2[FeeAmount2["LOW_400"] = 400] = "LOW_400";
  FeeAmount2[FeeAmount2["LOW"] = 500] = "LOW";
  FeeAmount2[FeeAmount2["MEDIUM"] = 3e3] = "MEDIUM";
  FeeAmount2[FeeAmount2["HIGH"] = 1e4] = "HIGH";
})(FeeAmount || (FeeAmount = {}));
var TICK_SPACINGS = (_TICK_SPACINGS = {}, _TICK_SPACINGS[FeeAmount.LOWEST] = 1, _TICK_SPACINGS[FeeAmount.LOW_200] = 4, _TICK_SPACINGS[FeeAmount.LOW_300] = 6, _TICK_SPACINGS[FeeAmount.LOW_400] = 8, _TICK_SPACINGS[FeeAmount.LOW] = 10, _TICK_SPACINGS[FeeAmount.MEDIUM] = 60, _TICK_SPACINGS[FeeAmount.HIGH] = 200, _TICK_SPACINGS);
var NEGATIVE_ONE = /* @__PURE__ */ jsbi_default.BigInt(-1);
var ZERO = /* @__PURE__ */ jsbi_default.BigInt(0);
var ONE = /* @__PURE__ */ jsbi_default.BigInt(1);
var Q96 = /* @__PURE__ */ jsbi_default.exponentiate(/* @__PURE__ */ jsbi_default.BigInt(2), /* @__PURE__ */ jsbi_default.BigInt(96));
var Q192 = /* @__PURE__ */ jsbi_default.exponentiate(Q96, /* @__PURE__ */ jsbi_default.BigInt(2));
function computePoolAddress(_ref) {
  var factoryAddress = _ref.factoryAddress, tokenA = _ref.tokenA, tokenB = _ref.tokenB, fee = _ref.fee, initCodeHashManualOverride = _ref.initCodeHashManualOverride, chainId = _ref.chainId;
  var _ref2 = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA], token0 = _ref2[0], token1 = _ref2[1];
  var salt = keccak2563(["bytes"], [defaultAbiCoder.encode(["address", "address", "uint24"], [token0.address, token1.address, fee])]);
  var initCodeHash = initCodeHashManualOverride != null ? initCodeHashManualOverride : poolInitCodeHash(chainId);
  switch (chainId) {
    case ChainId.ZKSYNC:
      return computeZksyncCreate2Address(factoryAddress, initCodeHash, salt);
    default:
      return getCreate2Address(factoryAddress, salt, initCodeHash);
  }
}
var FullMath = /* @__PURE__ */ function() {
  function FullMath2() {
  }
  FullMath2.mulDivRoundingUp = function mulDivRoundingUp(a, b, denominator) {
    var product = jsbi_default.multiply(a, b);
    var result = jsbi_default.divide(product, denominator);
    if (jsbi_default.notEqual(jsbi_default.remainder(product, denominator), ZERO)) result = jsbi_default.add(result, ONE);
    return result;
  };
  return FullMath2;
}();
var MaxUint160 = /* @__PURE__ */ jsbi_default.subtract(/* @__PURE__ */ jsbi_default.exponentiate(/* @__PURE__ */ jsbi_default.BigInt(2), /* @__PURE__ */ jsbi_default.BigInt(160)), ONE);
function multiplyIn256(x, y) {
  var product = jsbi_default.multiply(x, y);
  return jsbi_default.bitwiseAnd(product, MaxUint2562);
}
function addIn256(x, y) {
  var sum = jsbi_default.add(x, y);
  return jsbi_default.bitwiseAnd(sum, MaxUint2562);
}
var SqrtPriceMath = /* @__PURE__ */ function() {
  function SqrtPriceMath2() {
  }
  SqrtPriceMath2.getAmount0Delta = function getAmount0Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, roundUp) {
    if (jsbi_default.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
      var _ref = [sqrtRatioBX96, sqrtRatioAX96];
      sqrtRatioAX96 = _ref[0];
      sqrtRatioBX96 = _ref[1];
    }
    var numerator1 = jsbi_default.leftShift(liquidity, jsbi_default.BigInt(96));
    var numerator2 = jsbi_default.subtract(sqrtRatioBX96, sqrtRatioAX96);
    return roundUp ? FullMath.mulDivRoundingUp(FullMath.mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96), ONE, sqrtRatioAX96) : jsbi_default.divide(jsbi_default.divide(jsbi_default.multiply(numerator1, numerator2), sqrtRatioBX96), sqrtRatioAX96);
  };
  SqrtPriceMath2.getAmount1Delta = function getAmount1Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, roundUp) {
    if (jsbi_default.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
      var _ref2 = [sqrtRatioBX96, sqrtRatioAX96];
      sqrtRatioAX96 = _ref2[0];
      sqrtRatioBX96 = _ref2[1];
    }
    return roundUp ? FullMath.mulDivRoundingUp(liquidity, jsbi_default.subtract(sqrtRatioBX96, sqrtRatioAX96), Q96) : jsbi_default.divide(jsbi_default.multiply(liquidity, jsbi_default.subtract(sqrtRatioBX96, sqrtRatioAX96)), Q96);
  };
  SqrtPriceMath2.getNextSqrtPriceFromInput = function getNextSqrtPriceFromInput(sqrtPX96, liquidity, amountIn, zeroForOne) {
    !jsbi_default.greaterThan(sqrtPX96, ZERO) ? process.env.NODE_ENV !== "production" ? invariant(false) : invariant(false) : void 0;
    !jsbi_default.greaterThan(liquidity, ZERO) ? process.env.NODE_ENV !== "production" ? invariant(false) : invariant(false) : void 0;
    return zeroForOne ? this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountIn, true) : this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountIn, true);
  };
  SqrtPriceMath2.getNextSqrtPriceFromOutput = function getNextSqrtPriceFromOutput(sqrtPX96, liquidity, amountOut, zeroForOne) {
    !jsbi_default.greaterThan(sqrtPX96, ZERO) ? process.env.NODE_ENV !== "production" ? invariant(false) : invariant(false) : void 0;
    !jsbi_default.greaterThan(liquidity, ZERO) ? process.env.NODE_ENV !== "production" ? invariant(false) : invariant(false) : void 0;
    return zeroForOne ? this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountOut, false) : this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountOut, false);
  };
  SqrtPriceMath2.getNextSqrtPriceFromAmount0RoundingUp = function getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amount, add) {
    if (jsbi_default.equal(amount, ZERO)) return sqrtPX96;
    var numerator1 = jsbi_default.leftShift(liquidity, jsbi_default.BigInt(96));
    if (add) {
      var product = multiplyIn256(amount, sqrtPX96);
      if (jsbi_default.equal(jsbi_default.divide(product, amount), sqrtPX96)) {
        var denominator = addIn256(numerator1, product);
        if (jsbi_default.greaterThanOrEqual(denominator, numerator1)) {
          return FullMath.mulDivRoundingUp(numerator1, sqrtPX96, denominator);
        }
      }
      return FullMath.mulDivRoundingUp(numerator1, ONE, jsbi_default.add(jsbi_default.divide(numerator1, sqrtPX96), amount));
    } else {
      var _product = multiplyIn256(amount, sqrtPX96);
      !jsbi_default.equal(jsbi_default.divide(_product, amount), sqrtPX96) ? process.env.NODE_ENV !== "production" ? invariant(false) : invariant(false) : void 0;
      !jsbi_default.greaterThan(numerator1, _product) ? process.env.NODE_ENV !== "production" ? invariant(false) : invariant(false) : void 0;
      var _denominator = jsbi_default.subtract(numerator1, _product);
      return FullMath.mulDivRoundingUp(numerator1, sqrtPX96, _denominator);
    }
  };
  SqrtPriceMath2.getNextSqrtPriceFromAmount1RoundingDown = function getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amount, add) {
    if (add) {
      var quotient = jsbi_default.lessThanOrEqual(amount, MaxUint160) ? jsbi_default.divide(jsbi_default.leftShift(amount, jsbi_default.BigInt(96)), liquidity) : jsbi_default.divide(jsbi_default.multiply(amount, Q96), liquidity);
      return jsbi_default.add(sqrtPX96, quotient);
    } else {
      var _quotient = FullMath.mulDivRoundingUp(amount, Q96, liquidity);
      !jsbi_default.greaterThan(sqrtPX96, _quotient) ? process.env.NODE_ENV !== "production" ? invariant(false) : invariant(false) : void 0;
      return jsbi_default.subtract(sqrtPX96, _quotient);
    }
  };
  return SqrtPriceMath2;
}();
var MAX_FEE = /* @__PURE__ */ jsbi_default.exponentiate(/* @__PURE__ */ jsbi_default.BigInt(10), /* @__PURE__ */ jsbi_default.BigInt(6));
var SwapMath = /* @__PURE__ */ function() {
  function SwapMath2() {
  }
  SwapMath2.computeSwapStep = function computeSwapStep(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, amountRemaining, feePips) {
    var returnValues = {};
    feePips = jsbi_default.BigInt(feePips);
    var zeroForOne = jsbi_default.greaterThanOrEqual(sqrtRatioCurrentX96, sqrtRatioTargetX96);
    var exactIn = jsbi_default.greaterThanOrEqual(amountRemaining, ZERO);
    if (exactIn) {
      var amountRemainingLessFee = jsbi_default.divide(jsbi_default.multiply(amountRemaining, jsbi_default.subtract(MAX_FEE, feePips)), MAX_FEE);
      returnValues.amountIn = zeroForOne ? SqrtPriceMath.getAmount0Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, true) : SqrtPriceMath.getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, true);
      if (jsbi_default.greaterThanOrEqual(amountRemainingLessFee, returnValues.amountIn)) {
        returnValues.sqrtRatioNextX96 = sqrtRatioTargetX96;
      } else {
        returnValues.sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromInput(sqrtRatioCurrentX96, liquidity, amountRemainingLessFee, zeroForOne);
      }
    } else {
      returnValues.amountOut = zeroForOne ? SqrtPriceMath.getAmount1Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, false) : SqrtPriceMath.getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, false);
      if (jsbi_default.greaterThanOrEqual(jsbi_default.multiply(amountRemaining, NEGATIVE_ONE), returnValues.amountOut)) {
        returnValues.sqrtRatioNextX96 = sqrtRatioTargetX96;
      } else {
        returnValues.sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromOutput(sqrtRatioCurrentX96, liquidity, jsbi_default.multiply(amountRemaining, NEGATIVE_ONE), zeroForOne);
      }
    }
    var max = jsbi_default.equal(sqrtRatioTargetX96, returnValues.sqrtRatioNextX96);
    if (zeroForOne) {
      returnValues.amountIn = max && exactIn ? returnValues.amountIn : SqrtPriceMath.getAmount0Delta(returnValues.sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, true);
      returnValues.amountOut = max && !exactIn ? returnValues.amountOut : SqrtPriceMath.getAmount1Delta(returnValues.sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, false);
    } else {
      returnValues.amountIn = max && exactIn ? returnValues.amountIn : SqrtPriceMath.getAmount1Delta(sqrtRatioCurrentX96, returnValues.sqrtRatioNextX96, liquidity, true);
      returnValues.amountOut = max && !exactIn ? returnValues.amountOut : SqrtPriceMath.getAmount0Delta(sqrtRatioCurrentX96, returnValues.sqrtRatioNextX96, liquidity, false);
    }
    if (!exactIn && jsbi_default.greaterThan(returnValues.amountOut, jsbi_default.multiply(amountRemaining, NEGATIVE_ONE))) {
      returnValues.amountOut = jsbi_default.multiply(amountRemaining, NEGATIVE_ONE);
    }
    if (exactIn && jsbi_default.notEqual(returnValues.sqrtRatioNextX96, sqrtRatioTargetX96)) {
      returnValues.feeAmount = jsbi_default.subtract(amountRemaining, returnValues.amountIn);
    } else {
      returnValues.feeAmount = FullMath.mulDivRoundingUp(returnValues.amountIn, feePips, jsbi_default.subtract(MAX_FEE, feePips));
    }
    return [returnValues.sqrtRatioNextX96, returnValues.amountIn, returnValues.amountOut, returnValues.feeAmount];
  };
  return SwapMath2;
}();
var LiquidityMath = /* @__PURE__ */ function() {
  function LiquidityMath2() {
  }
  LiquidityMath2.addDelta = function addDelta(x, y) {
    if (jsbi_default.lessThan(y, ZERO)) {
      return jsbi_default.subtract(x, jsbi_default.multiply(y, NEGATIVE_ONE));
    } else {
      return jsbi_default.add(x, y);
    }
  };
  return LiquidityMath2;
}();
var TWO = /* @__PURE__ */ jsbi_default.BigInt(2);
var POWERS_OF_2 = /* @__PURE__ */ [128, 64, 32, 16, 8, 4, 2, 1].map(function(pow) {
  return [pow, jsbi_default.exponentiate(TWO, jsbi_default.BigInt(pow))];
});
function mostSignificantBit(x) {
  !jsbi_default.greaterThan(x, ZERO) ? process.env.NODE_ENV !== "production" ? invariant(false, "ZERO") : invariant(false) : void 0;
  !jsbi_default.lessThanOrEqual(x, MaxUint2562) ? process.env.NODE_ENV !== "production" ? invariant(false, "MAX") : invariant(false) : void 0;
  var msb = 0;
  for (var _iterator = _createForOfIteratorHelperLoose(POWERS_OF_2), _step; !(_step = _iterator()).done; ) {
    var _step$value = _step.value, power = _step$value[0], min = _step$value[1];
    if (jsbi_default.greaterThanOrEqual(x, min)) {
      x = jsbi_default.signedRightShift(x, jsbi_default.BigInt(power));
      msb += power;
    }
  }
  return msb;
}
function mulShift(val, mulBy) {
  return jsbi_default.signedRightShift(jsbi_default.multiply(val, jsbi_default.BigInt(mulBy)), jsbi_default.BigInt(128));
}
var Q32 = /* @__PURE__ */ jsbi_default.exponentiate(/* @__PURE__ */ jsbi_default.BigInt(2), /* @__PURE__ */ jsbi_default.BigInt(32));
var TickMath = /* @__PURE__ */ function() {
  function TickMath2() {
  }
  TickMath2.getSqrtRatioAtTick = function getSqrtRatioAtTick(tick) {
    !(tick >= TickMath2.MIN_TICK && tick <= TickMath2.MAX_TICK && Number.isInteger(tick)) ? process.env.NODE_ENV !== "production" ? invariant(false, "TICK") : invariant(false) : void 0;
    var absTick = tick < 0 ? tick * -1 : tick;
    var ratio = (absTick & 1) !== 0 ? jsbi_default.BigInt("0xfffcb933bd6fad37aa2d162d1a594001") : jsbi_default.BigInt("0x100000000000000000000000000000000");
    if ((absTick & 2) !== 0) ratio = mulShift(ratio, "0xfff97272373d413259a46990580e213a");
    if ((absTick & 4) !== 0) ratio = mulShift(ratio, "0xfff2e50f5f656932ef12357cf3c7fdcc");
    if ((absTick & 8) !== 0) ratio = mulShift(ratio, "0xffe5caca7e10e4e61c3624eaa0941cd0");
    if ((absTick & 16) !== 0) ratio = mulShift(ratio, "0xffcb9843d60f6159c9db58835c926644");
    if ((absTick & 32) !== 0) ratio = mulShift(ratio, "0xff973b41fa98c081472e6896dfb254c0");
    if ((absTick & 64) !== 0) ratio = mulShift(ratio, "0xff2ea16466c96a3843ec78b326b52861");
    if ((absTick & 128) !== 0) ratio = mulShift(ratio, "0xfe5dee046a99a2a811c461f1969c3053");
    if ((absTick & 256) !== 0) ratio = mulShift(ratio, "0xfcbe86c7900a88aedcffc83b479aa3a4");
    if ((absTick & 512) !== 0) ratio = mulShift(ratio, "0xf987a7253ac413176f2b074cf7815e54");
    if ((absTick & 1024) !== 0) ratio = mulShift(ratio, "0xf3392b0822b70005940c7a398e4b70f3");
    if ((absTick & 2048) !== 0) ratio = mulShift(ratio, "0xe7159475a2c29b7443b29c7fa6e889d9");
    if ((absTick & 4096) !== 0) ratio = mulShift(ratio, "0xd097f3bdfd2022b8845ad8f792aa5825");
    if ((absTick & 8192) !== 0) ratio = mulShift(ratio, "0xa9f746462d870fdf8a65dc1f90e061e5");
    if ((absTick & 16384) !== 0) ratio = mulShift(ratio, "0x70d869a156d2a1b890bb3df62baf32f7");
    if ((absTick & 32768) !== 0) ratio = mulShift(ratio, "0x31be135f97d08fd981231505542fcfa6");
    if ((absTick & 65536) !== 0) ratio = mulShift(ratio, "0x9aa508b5b7a84e1c677de54f3e99bc9");
    if ((absTick & 131072) !== 0) ratio = mulShift(ratio, "0x5d6af8dedb81196699c329225ee604");
    if ((absTick & 262144) !== 0) ratio = mulShift(ratio, "0x2216e584f5fa1ea926041bedfe98");
    if ((absTick & 524288) !== 0) ratio = mulShift(ratio, "0x48a170391f7dc42444e8fa2");
    if (tick > 0) ratio = jsbi_default.divide(MaxUint2562, ratio);
    return jsbi_default.greaterThan(jsbi_default.remainder(ratio, Q32), ZERO) ? jsbi_default.add(jsbi_default.divide(ratio, Q32), ONE) : jsbi_default.divide(ratio, Q32);
  };
  TickMath2.getTickAtSqrtRatio = function getTickAtSqrtRatio(sqrtRatioX96) {
    !(jsbi_default.greaterThanOrEqual(sqrtRatioX96, TickMath2.MIN_SQRT_RATIO) && jsbi_default.lessThan(sqrtRatioX96, TickMath2.MAX_SQRT_RATIO)) ? process.env.NODE_ENV !== "production" ? invariant(false, "SQRT_RATIO") : invariant(false) : void 0;
    var sqrtRatioX128 = jsbi_default.leftShift(sqrtRatioX96, jsbi_default.BigInt(32));
    var msb = mostSignificantBit(sqrtRatioX128);
    var r;
    if (jsbi_default.greaterThanOrEqual(jsbi_default.BigInt(msb), jsbi_default.BigInt(128))) {
      r = jsbi_default.signedRightShift(sqrtRatioX128, jsbi_default.BigInt(msb - 127));
    } else {
      r = jsbi_default.leftShift(sqrtRatioX128, jsbi_default.BigInt(127 - msb));
    }
    var log_2 = jsbi_default.leftShift(jsbi_default.subtract(jsbi_default.BigInt(msb), jsbi_default.BigInt(128)), jsbi_default.BigInt(64));
    for (var i = 0; i < 14; i++) {
      r = jsbi_default.signedRightShift(jsbi_default.multiply(r, r), jsbi_default.BigInt(127));
      var f = jsbi_default.signedRightShift(r, jsbi_default.BigInt(128));
      log_2 = jsbi_default.bitwiseOr(log_2, jsbi_default.leftShift(f, jsbi_default.BigInt(63 - i)));
      r = jsbi_default.signedRightShift(r, f);
    }
    var log_sqrt10001 = jsbi_default.multiply(log_2, jsbi_default.BigInt("255738958999603826347141"));
    var tickLow = jsbi_default.toNumber(jsbi_default.signedRightShift(jsbi_default.subtract(log_sqrt10001, jsbi_default.BigInt("3402992956809132418596140100660247210")), jsbi_default.BigInt(128)));
    var tickHigh = jsbi_default.toNumber(jsbi_default.signedRightShift(jsbi_default.add(log_sqrt10001, jsbi_default.BigInt("291339464771989622907027621153398088495")), jsbi_default.BigInt(128)));
    return tickLow === tickHigh ? tickLow : jsbi_default.lessThanOrEqual(TickMath2.getSqrtRatioAtTick(tickHigh), sqrtRatioX96) ? tickHigh : tickLow;
  };
  return TickMath2;
}();
TickMath.MIN_TICK = -887272;
TickMath.MAX_TICK = -TickMath.MIN_TICK;
TickMath.MIN_SQRT_RATIO = /* @__PURE__ */ jsbi_default.BigInt("4295128739");
TickMath.MAX_SQRT_RATIO = /* @__PURE__ */ jsbi_default.BigInt("1461446703485210103287273052203988822378723970342");
function v3Swap(_x, _x2, _x3, _x4, _x5, _x6, _x7, _x8, _x9) {
  return _v3Swap.apply(this, arguments);
}
function _v3Swap() {
  _v3Swap = _asyncToGenerator(/* @__PURE__ */ _regeneratorRuntime().mark(function _callee(fee, sqrtRatioX96, tickCurrent, liquidity, tickSpacing, tickDataProvider, zeroForOne, amountSpecified, sqrtPriceLimitX96) {
    var exactInput, state, step, _yield$tickDataProvid, _SwapMath$computeSwap, liquidityNet;
    return _regeneratorRuntime().wrap(function _callee$(_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          if (!sqrtPriceLimitX96) sqrtPriceLimitX96 = zeroForOne ? jsbi_default.add(TickMath.MIN_SQRT_RATIO, ONE) : jsbi_default.subtract(TickMath.MAX_SQRT_RATIO, ONE);
          if (zeroForOne) {
            !jsbi_default.greaterThan(sqrtPriceLimitX96, TickMath.MIN_SQRT_RATIO) ? process.env.NODE_ENV !== "production" ? invariant(false, "RATIO_MIN") : invariant(false) : void 0;
            !jsbi_default.lessThan(sqrtPriceLimitX96, sqrtRatioX96) ? process.env.NODE_ENV !== "production" ? invariant(false, "RATIO_CURRENT") : invariant(false) : void 0;
          } else {
            !jsbi_default.lessThan(sqrtPriceLimitX96, TickMath.MAX_SQRT_RATIO) ? process.env.NODE_ENV !== "production" ? invariant(false, "RATIO_MAX") : invariant(false) : void 0;
            !jsbi_default.greaterThan(sqrtPriceLimitX96, sqrtRatioX96) ? process.env.NODE_ENV !== "production" ? invariant(false, "RATIO_CURRENT") : invariant(false) : void 0;
          }
          exactInput = jsbi_default.greaterThanOrEqual(amountSpecified, ZERO);
          state = {
            amountSpecifiedRemaining: amountSpecified,
            amountCalculated: ZERO,
            sqrtPriceX96: sqrtRatioX96,
            tick: tickCurrent,
            liquidity
          };
        // start swap while loop
        case 4:
          if (!(jsbi_default.notEqual(state.amountSpecifiedRemaining, ZERO) && state.sqrtPriceX96 !== sqrtPriceLimitX96)) {
            _context.next = 35;
            break;
          }
          step = {};
          step.sqrtPriceStartX96 = state.sqrtPriceX96;
          _context.next = 9;
          return tickDataProvider.nextInitializedTickWithinOneWord(state.tick, zeroForOne, tickSpacing);
        case 9:
          _yield$tickDataProvid = _context.sent;
          step.tickNext = _yield$tickDataProvid[0];
          step.initialized = _yield$tickDataProvid[1];
          if (step.tickNext < TickMath.MIN_TICK) {
            step.tickNext = TickMath.MIN_TICK;
          } else if (step.tickNext > TickMath.MAX_TICK) {
            step.tickNext = TickMath.MAX_TICK;
          }
          step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext);
          _SwapMath$computeSwap = SwapMath.computeSwapStep(state.sqrtPriceX96, (zeroForOne ? jsbi_default.lessThan(step.sqrtPriceNextX96, sqrtPriceLimitX96) : jsbi_default.greaterThan(step.sqrtPriceNextX96, sqrtPriceLimitX96)) ? sqrtPriceLimitX96 : step.sqrtPriceNextX96, state.liquidity, state.amountSpecifiedRemaining, fee);
          state.sqrtPriceX96 = _SwapMath$computeSwap[0];
          step.amountIn = _SwapMath$computeSwap[1];
          step.amountOut = _SwapMath$computeSwap[2];
          step.feeAmount = _SwapMath$computeSwap[3];
          if (exactInput) {
            state.amountSpecifiedRemaining = jsbi_default.subtract(state.amountSpecifiedRemaining, jsbi_default.add(step.amountIn, step.feeAmount));
            state.amountCalculated = jsbi_default.subtract(state.amountCalculated, step.amountOut);
          } else {
            state.amountSpecifiedRemaining = jsbi_default.add(state.amountSpecifiedRemaining, step.amountOut);
            state.amountCalculated = jsbi_default.add(state.amountCalculated, jsbi_default.add(step.amountIn, step.feeAmount));
          }
          if (!jsbi_default.equal(state.sqrtPriceX96, step.sqrtPriceNextX96)) {
            _context.next = 32;
            break;
          }
          if (!step.initialized) {
            _context.next = 29;
            break;
          }
          _context.t0 = jsbi_default;
          _context.next = 25;
          return tickDataProvider.getTick(step.tickNext);
        case 25:
          _context.t1 = _context.sent.liquidityNet;
          liquidityNet = _context.t0.BigInt.call(_context.t0, _context.t1);
          if (zeroForOne) liquidityNet = jsbi_default.multiply(liquidityNet, NEGATIVE_ONE);
          state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet);
        case 29:
          state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext;
          _context.next = 33;
          break;
        case 32:
          if (jsbi_default.notEqual(state.sqrtPriceX96, step.sqrtPriceStartX96)) {
            state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
          }
        case 33:
          _context.next = 4;
          break;
        case 35:
          return _context.abrupt("return", {
            amountCalculated: state.amountCalculated,
            sqrtRatioX96: state.sqrtPriceX96,
            liquidity: state.liquidity,
            tickCurrent: state.tick
          });
        case 36:
        case "end":
          return _context.stop();
      }
    }, _callee);
  }));
  return _v3Swap.apply(this, arguments);
}
var NoTickDataProvider = /* @__PURE__ */ function() {
  function NoTickDataProvider2() {
  }
  var _proto = NoTickDataProvider2.prototype;
  _proto.getTick = /* @__PURE__ */ function() {
    var _getTick = /* @__PURE__ */ _asyncToGenerator(/* @__PURE__ */ _regeneratorRuntime().mark(function _callee(_tick) {
      return _regeneratorRuntime().wrap(function _callee$(_context) {
        while (1) switch (_context.prev = _context.next) {
          case 0:
            throw new Error(NoTickDataProvider2.ERROR_MESSAGE);
          case 1:
          case "end":
            return _context.stop();
        }
      }, _callee);
    }));
    function getTick(_x) {
      return _getTick.apply(this, arguments);
    }
    return getTick;
  }();
  _proto.nextInitializedTickWithinOneWord = /* @__PURE__ */ function() {
    var _nextInitializedTickWithinOneWord = /* @__PURE__ */ _asyncToGenerator(/* @__PURE__ */ _regeneratorRuntime().mark(function _callee2(_tick, _lte, _tickSpacing) {
      return _regeneratorRuntime().wrap(function _callee2$(_context2) {
        while (1) switch (_context2.prev = _context2.next) {
          case 0:
            throw new Error(NoTickDataProvider2.ERROR_MESSAGE);
          case 1:
          case "end":
            return _context2.stop();
        }
      }, _callee2);
    }));
    function nextInitializedTickWithinOneWord(_x2, _x3, _x4) {
      return _nextInitializedTickWithinOneWord.apply(this, arguments);
    }
    return nextInitializedTickWithinOneWord;
  }();
  return NoTickDataProvider2;
}();
NoTickDataProvider.ERROR_MESSAGE = "No tick data provider was given";
function isSorted(list, comparator) {
  for (var i = 0; i < list.length - 1; i++) {
    if (comparator(list[i], list[i + 1]) > 0) {
      return false;
    }
  }
  return true;
}
function tickComparator(a, b) {
  return a.index - b.index;
}
var TickList = /* @__PURE__ */ function() {
  function TickList2() {
  }
  TickList2.validateList = function validateList(ticks, tickSpacing) {
    !(tickSpacing > 0) ? process.env.NODE_ENV !== "production" ? invariant(false, "TICK_SPACING_NONZERO") : invariant(false) : void 0;
    !ticks.every(function(_ref) {
      var index = _ref.index;
      return index % tickSpacing === 0;
    }) ? process.env.NODE_ENV !== "production" ? invariant(false, "TICK_SPACING") : invariant(false) : void 0;
    !jsbi_default.equal(ticks.reduce(function(accumulator, _ref2) {
      var liquidityNet = _ref2.liquidityNet;
      return jsbi_default.add(accumulator, liquidityNet);
    }, ZERO), ZERO) ? process.env.NODE_ENV !== "production" ? invariant(false, "ZERO_NET") : invariant(false) : void 0;
    !isSorted(ticks, tickComparator) ? process.env.NODE_ENV !== "production" ? invariant(false, "SORTED") : invariant(false) : void 0;
  };
  TickList2.isBelowSmallest = function isBelowSmallest(ticks, tick) {
    !(ticks.length > 0) ? process.env.NODE_ENV !== "production" ? invariant(false, "LENGTH") : invariant(false) : void 0;
    return tick < ticks[0].index;
  };
  TickList2.isAtOrAboveLargest = function isAtOrAboveLargest(ticks, tick) {
    !(ticks.length > 0) ? process.env.NODE_ENV !== "production" ? invariant(false, "LENGTH") : invariant(false) : void 0;
    return tick >= ticks[ticks.length - 1].index;
  };
  TickList2.getTick = function getTick(ticks, index) {
    var tick = ticks[this.binarySearch(ticks, index)];
    !(tick.index === index) ? process.env.NODE_ENV !== "production" ? invariant(false, "NOT_CONTAINED") : invariant(false) : void 0;
    return tick;
  };
  TickList2.binarySearch = function binarySearch(ticks, tick) {
    !!this.isBelowSmallest(ticks, tick) ? process.env.NODE_ENV !== "production" ? invariant(false, "BELOW_SMALLEST") : invariant(false) : void 0;
    var l = 0;
    var r = ticks.length - 1;
    var i;
    while (true) {
      i = Math.floor((l + r) / 2);
      if (ticks[i].index <= tick && (i === ticks.length - 1 || ticks[i + 1].index > tick)) {
        return i;
      }
      if (ticks[i].index < tick) {
        l = i + 1;
      } else {
        r = i - 1;
      }
    }
  };
  TickList2.nextInitializedTick = function nextInitializedTick(ticks, tick, lte) {
    if (lte) {
      !!TickList2.isBelowSmallest(ticks, tick) ? process.env.NODE_ENV !== "production" ? invariant(false, "BELOW_SMALLEST") : invariant(false) : void 0;
      if (TickList2.isAtOrAboveLargest(ticks, tick)) {
        return ticks[ticks.length - 1];
      }
      var index = this.binarySearch(ticks, tick);
      return ticks[index];
    } else {
      !!this.isAtOrAboveLargest(ticks, tick) ? process.env.NODE_ENV !== "production" ? invariant(false, "AT_OR_ABOVE_LARGEST") : invariant(false) : void 0;
      if (this.isBelowSmallest(ticks, tick)) {
        return ticks[0];
      }
      var _index = this.binarySearch(ticks, tick);
      return ticks[_index + 1];
    }
  };
  TickList2.nextInitializedTickWithinOneWord = function nextInitializedTickWithinOneWord(ticks, tick, lte, tickSpacing) {
    var compressed = Math.floor(tick / tickSpacing);
    if (lte) {
      var wordPos = compressed >> 8;
      var minimum = (wordPos << 8) * tickSpacing;
      if (TickList2.isBelowSmallest(ticks, tick)) {
        return [minimum, false];
      }
      var index = TickList2.nextInitializedTick(ticks, tick, lte).index;
      var nextInitializedTick = Math.max(minimum, index);
      return [nextInitializedTick, nextInitializedTick === index];
    } else {
      var _wordPos = compressed + 1 >> 8;
      var maximum = ((_wordPos + 1 << 8) - 1) * tickSpacing;
      if (this.isAtOrAboveLargest(ticks, tick)) {
        return [maximum, false];
      }
      var _index2 = this.nextInitializedTick(ticks, tick, lte).index;
      var _nextInitializedTick = Math.min(maximum, _index2);
      return [_nextInitializedTick, _nextInitializedTick === _index2];
    }
  };
  return TickList2;
}();
function toHex3(bigintIsh) {
  var bigInt = jsbi_default.BigInt(bigintIsh);
  var hex = bigInt.toString(16);
  if (hex.length % 2 !== 0) {
    hex = "0" + hex;
  }
  return "0x" + hex;
}
function encodeRouteToPath(route, exactOutput) {
  var firstInputToken = route.input.wrapped;
  var _route$pools$reduce = route.pools.reduce(function(_ref, pool, index) {
    var inputToken = _ref.inputToken, path2 = _ref.path, types2 = _ref.types;
    var outputToken = pool.token0.equals(inputToken) ? pool.token1 : pool.token0;
    if (index === 0) {
      return {
        inputToken: outputToken,
        types: ["address", "uint24", "address"],
        path: [inputToken.address, pool.fee, outputToken.address]
      };
    } else {
      return {
        inputToken: outputToken,
        types: [].concat(types2, ["uint24", "address"]),
        path: [].concat(path2, [pool.fee, outputToken.address])
      };
    }
  }, {
    inputToken: firstInputToken,
    path: [],
    types: []
  }), path = _route$pools$reduce.path, types = _route$pools$reduce.types;
  return exactOutput ? pack2(types.reverse(), path.reverse()) : pack2(types, path);
}
function encodeSqrtRatioX96(amount1, amount0) {
  var numerator = jsbi_default.leftShift(jsbi_default.BigInt(amount1), jsbi_default.BigInt(192));
  var denominator = jsbi_default.BigInt(amount0);
  var ratioX192 = jsbi_default.divide(numerator, denominator);
  return sqrt(ratioX192);
}
function maxLiquidityForAmount0Imprecise(sqrtRatioAX96, sqrtRatioBX96, amount0) {
  if (jsbi_default.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    var _ref = [sqrtRatioBX96, sqrtRatioAX96];
    sqrtRatioAX96 = _ref[0];
    sqrtRatioBX96 = _ref[1];
  }
  var intermediate = jsbi_default.divide(jsbi_default.multiply(sqrtRatioAX96, sqrtRatioBX96), Q96);
  return jsbi_default.divide(jsbi_default.multiply(jsbi_default.BigInt(amount0), intermediate), jsbi_default.subtract(sqrtRatioBX96, sqrtRatioAX96));
}
function maxLiquidityForAmount0Precise(sqrtRatioAX96, sqrtRatioBX96, amount0) {
  if (jsbi_default.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    var _ref2 = [sqrtRatioBX96, sqrtRatioAX96];
    sqrtRatioAX96 = _ref2[0];
    sqrtRatioBX96 = _ref2[1];
  }
  var numerator = jsbi_default.multiply(jsbi_default.multiply(jsbi_default.BigInt(amount0), sqrtRatioAX96), sqrtRatioBX96);
  var denominator = jsbi_default.multiply(Q96, jsbi_default.subtract(sqrtRatioBX96, sqrtRatioAX96));
  return jsbi_default.divide(numerator, denominator);
}
function maxLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1) {
  if (jsbi_default.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    var _ref3 = [sqrtRatioBX96, sqrtRatioAX96];
    sqrtRatioAX96 = _ref3[0];
    sqrtRatioBX96 = _ref3[1];
  }
  return jsbi_default.divide(jsbi_default.multiply(jsbi_default.BigInt(amount1), Q96), jsbi_default.subtract(sqrtRatioBX96, sqrtRatioAX96));
}
function maxLiquidityForAmounts(sqrtRatioCurrentX96, sqrtRatioAX96, sqrtRatioBX96, amount0, amount1, useFullPrecision) {
  if (jsbi_default.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    var _ref4 = [sqrtRatioBX96, sqrtRatioAX96];
    sqrtRatioAX96 = _ref4[0];
    sqrtRatioBX96 = _ref4[1];
  }
  var maxLiquidityForAmount0 = useFullPrecision ? maxLiquidityForAmount0Precise : maxLiquidityForAmount0Imprecise;
  if (jsbi_default.lessThanOrEqual(sqrtRatioCurrentX96, sqrtRatioAX96)) {
    return maxLiquidityForAmount0(sqrtRatioAX96, sqrtRatioBX96, amount0);
  } else if (jsbi_default.lessThan(sqrtRatioCurrentX96, sqrtRatioBX96)) {
    var liquidity0 = maxLiquidityForAmount0(sqrtRatioCurrentX96, sqrtRatioBX96, amount0);
    var liquidity1 = maxLiquidityForAmount1(sqrtRatioAX96, sqrtRatioCurrentX96, amount1);
    return jsbi_default.lessThan(liquidity0, liquidity1) ? liquidity0 : liquidity1;
  } else {
    return maxLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1);
  }
}
function tickToPrice(baseToken, quoteToken, tick) {
  var sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
  var ratioX192 = jsbi_default.multiply(sqrtRatioX96, sqrtRatioX96);
  return baseToken.sortsBefore(quoteToken) ? new Price(baseToken, quoteToken, Q192, ratioX192) : new Price(baseToken, quoteToken, ratioX192, Q192);
}
var Tick = function Tick2(_ref) {
  var index = _ref.index, liquidityGross = _ref.liquidityGross, liquidityNet = _ref.liquidityNet;
  !(index >= TickMath.MIN_TICK && index <= TickMath.MAX_TICK) ? process.env.NODE_ENV !== "production" ? invariant(false, "TICK") : invariant(false) : void 0;
  this.index = index;
  this.liquidityGross = jsbi_default.BigInt(liquidityGross);
  this.liquidityNet = jsbi_default.BigInt(liquidityNet);
};
var TickListDataProvider = /* @__PURE__ */ function() {
  function TickListDataProvider2(ticks, tickSpacing) {
    var ticksMapped = ticks.map(function(t) {
      return t instanceof Tick ? t : new Tick(t);
    });
    TickList.validateList(ticksMapped, tickSpacing);
    this.ticks = ticksMapped;
  }
  var _proto = TickListDataProvider2.prototype;
  _proto.getTick = /* @__PURE__ */ function() {
    var _getTick = /* @__PURE__ */ _asyncToGenerator(/* @__PURE__ */ _regeneratorRuntime().mark(function _callee(tick) {
      return _regeneratorRuntime().wrap(function _callee$(_context) {
        while (1) switch (_context.prev = _context.next) {
          case 0:
            return _context.abrupt("return", TickList.getTick(this.ticks, tick));
          case 1:
          case "end":
            return _context.stop();
        }
      }, _callee, this);
    }));
    function getTick(_x) {
      return _getTick.apply(this, arguments);
    }
    return getTick;
  }();
  _proto.nextInitializedTickWithinOneWord = /* @__PURE__ */ function() {
    var _nextInitializedTickWithinOneWord = /* @__PURE__ */ _asyncToGenerator(/* @__PURE__ */ _regeneratorRuntime().mark(function _callee2(tick, lte, tickSpacing) {
      return _regeneratorRuntime().wrap(function _callee2$(_context2) {
        while (1) switch (_context2.prev = _context2.next) {
          case 0:
            return _context2.abrupt("return", TickList.nextInitializedTickWithinOneWord(this.ticks, tick, lte, tickSpacing));
          case 1:
          case "end":
            return _context2.stop();
        }
      }, _callee2, this);
    }));
    function nextInitializedTickWithinOneWord(_x2, _x3, _x4) {
      return _nextInitializedTickWithinOneWord.apply(this, arguments);
    }
    return nextInitializedTickWithinOneWord;
  }();
  return TickListDataProvider2;
}();
var NO_TICK_DATA_PROVIDER_DEFAULT = /* @__PURE__ */ new NoTickDataProvider();
var Pool = /* @__PURE__ */ function() {
  function Pool2(tokenA, tokenB, fee, sqrtRatioX96, liquidity, tickCurrent, ticks) {
    if (ticks === void 0) {
      ticks = NO_TICK_DATA_PROVIDER_DEFAULT;
    }
    !(Number.isInteger(fee) && fee < 1e6) ? process.env.NODE_ENV !== "production" ? invariant(false, "FEE") : invariant(false) : void 0;
    var tickCurrentSqrtRatioX96 = TickMath.getSqrtRatioAtTick(tickCurrent);
    var nextTickSqrtRatioX96 = TickMath.getSqrtRatioAtTick(tickCurrent + 1);
    !(jsbi_default.greaterThanOrEqual(jsbi_default.BigInt(sqrtRatioX96), tickCurrentSqrtRatioX96) && jsbi_default.lessThanOrEqual(jsbi_default.BigInt(sqrtRatioX96), nextTickSqrtRatioX96)) ? process.env.NODE_ENV !== "production" ? invariant(false, "PRICE_BOUNDS") : invariant(false) : void 0;
    var _ref = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
    this.token0 = _ref[0];
    this.token1 = _ref[1];
    this.fee = fee;
    this.sqrtRatioX96 = jsbi_default.BigInt(sqrtRatioX96);
    this.liquidity = jsbi_default.BigInt(liquidity);
    this.tickCurrent = tickCurrent;
    this.tickDataProvider = Array.isArray(ticks) ? new TickListDataProvider(ticks, TICK_SPACINGS[fee]) : ticks;
  }
  Pool2.getAddress = function getAddress3(tokenA, tokenB, fee, initCodeHashManualOverride, factoryAddressOverride) {
    return computePoolAddress({
      factoryAddress: factoryAddressOverride != null ? factoryAddressOverride : FACTORY_ADDRESS,
      fee,
      tokenA,
      tokenB,
      initCodeHashManualOverride
    });
  };
  var _proto = Pool2.prototype;
  _proto.involvesToken = function involvesToken(token) {
    return token.equals(this.token0) || token.equals(this.token1);
  };
  _proto.priceOf = function priceOf(token) {
    !this.involvesToken(token) ? process.env.NODE_ENV !== "production" ? invariant(false, "TOKEN") : invariant(false) : void 0;
    return token.equals(this.token0) ? this.token0Price : this.token1Price;
  };
  _proto.getOutputAmount = /* @__PURE__ */ function() {
    var _getOutputAmount = /* @__PURE__ */ _asyncToGenerator(/* @__PURE__ */ _regeneratorRuntime().mark(function _callee(inputAmount, sqrtPriceLimitX96) {
      var zeroForOne, _yield$this$swap, outputAmount, sqrtRatioX96, liquidity, tickCurrent, outputToken;
      return _regeneratorRuntime().wrap(function _callee$(_context) {
        while (1) switch (_context.prev = _context.next) {
          case 0:
            !this.involvesToken(inputAmount.currency) ? process.env.NODE_ENV !== "production" ? invariant(false, "TOKEN") : invariant(false) : void 0;
            zeroForOne = inputAmount.currency.equals(this.token0);
            _context.next = 4;
            return this.swap(zeroForOne, inputAmount.quotient, sqrtPriceLimitX96);
          case 4:
            _yield$this$swap = _context.sent;
            outputAmount = _yield$this$swap.amountCalculated;
            sqrtRatioX96 = _yield$this$swap.sqrtRatioX96;
            liquidity = _yield$this$swap.liquidity;
            tickCurrent = _yield$this$swap.tickCurrent;
            outputToken = zeroForOne ? this.token1 : this.token0;
            return _context.abrupt("return", [CurrencyAmount.fromRawAmount(outputToken, jsbi_default.multiply(outputAmount, NEGATIVE_ONE)), new Pool2(this.token0, this.token1, this.fee, sqrtRatioX96, liquidity, tickCurrent, this.tickDataProvider)]);
          case 11:
          case "end":
            return _context.stop();
        }
      }, _callee, this);
    }));
    function getOutputAmount(_x, _x2) {
      return _getOutputAmount.apply(this, arguments);
    }
    return getOutputAmount;
  }();
  _proto.getInputAmount = /* @__PURE__ */ function() {
    var _getInputAmount = /* @__PURE__ */ _asyncToGenerator(/* @__PURE__ */ _regeneratorRuntime().mark(function _callee2(outputAmount, sqrtPriceLimitX96) {
      var zeroForOne, _yield$this$swap2, inputAmount, sqrtRatioX96, liquidity, tickCurrent, inputToken;
      return _regeneratorRuntime().wrap(function _callee2$(_context2) {
        while (1) switch (_context2.prev = _context2.next) {
          case 0:
            !(outputAmount.currency.isToken && this.involvesToken(outputAmount.currency)) ? process.env.NODE_ENV !== "production" ? invariant(false, "TOKEN") : invariant(false) : void 0;
            zeroForOne = outputAmount.currency.equals(this.token1);
            _context2.next = 4;
            return this.swap(zeroForOne, jsbi_default.multiply(outputAmount.quotient, NEGATIVE_ONE), sqrtPriceLimitX96);
          case 4:
            _yield$this$swap2 = _context2.sent;
            inputAmount = _yield$this$swap2.amountCalculated;
            sqrtRatioX96 = _yield$this$swap2.sqrtRatioX96;
            liquidity = _yield$this$swap2.liquidity;
            tickCurrent = _yield$this$swap2.tickCurrent;
            inputToken = zeroForOne ? this.token0 : this.token1;
            return _context2.abrupt("return", [CurrencyAmount.fromRawAmount(inputToken, inputAmount), new Pool2(this.token0, this.token1, this.fee, sqrtRatioX96, liquidity, tickCurrent, this.tickDataProvider)]);
          case 11:
          case "end":
            return _context2.stop();
        }
      }, _callee2, this);
    }));
    function getInputAmount(_x3, _x4) {
      return _getInputAmount.apply(this, arguments);
    }
    return getInputAmount;
  }();
  _proto.swap = /* @__PURE__ */ function() {
    var _swap = /* @__PURE__ */ _asyncToGenerator(/* @__PURE__ */ _regeneratorRuntime().mark(function _callee3(zeroForOne, amountSpecified, sqrtPriceLimitX96) {
      return _regeneratorRuntime().wrap(function _callee3$(_context3) {
        while (1) switch (_context3.prev = _context3.next) {
          case 0:
            return _context3.abrupt("return", v3Swap(jsbi_default.BigInt(this.fee), this.sqrtRatioX96, this.tickCurrent, this.liquidity, this.tickSpacing, this.tickDataProvider, zeroForOne, amountSpecified, sqrtPriceLimitX96));
          case 1:
          case "end":
            return _context3.stop();
        }
      }, _callee3, this);
    }));
    function swap(_x5, _x6, _x7) {
      return _swap.apply(this, arguments);
    }
    return swap;
  }();
  _createClass(Pool2, [{
    key: "token0Price",
    get: function get() {
      var _this$_token0Price;
      return (_this$_token0Price = this._token0Price) != null ? _this$_token0Price : this._token0Price = new Price(this.token0, this.token1, Q192, jsbi_default.multiply(this.sqrtRatioX96, this.sqrtRatioX96));
    }
    /**
     * Returns the current mid price of the pool in terms of token1, i.e. the ratio of token0 over token1
     */
  }, {
    key: "token1Price",
    get: function get() {
      var _this$_token1Price;
      return (_this$_token1Price = this._token1Price) != null ? _this$_token1Price : this._token1Price = new Price(this.token1, this.token0, jsbi_default.multiply(this.sqrtRatioX96, this.sqrtRatioX96), Q192);
    }
  }, {
    key: "chainId",
    get: function get() {
      return this.token0.chainId;
    }
  }, {
    key: "tickSpacing",
    get: function get() {
      return TICK_SPACINGS[this.fee];
    }
  }]);
  return Pool2;
}();
var Position = /* @__PURE__ */ function() {
  function Position2(_ref) {
    var pool = _ref.pool, liquidity = _ref.liquidity, tickLower = _ref.tickLower, tickUpper = _ref.tickUpper;
    this._token0Amount = null;
    this._token1Amount = null;
    this._mintAmounts = null;
    !(tickLower < tickUpper) ? process.env.NODE_ENV !== "production" ? invariant(false, "TICK_ORDER") : invariant(false) : void 0;
    !(tickLower >= TickMath.MIN_TICK && tickLower % pool.tickSpacing === 0) ? process.env.NODE_ENV !== "production" ? invariant(false, "TICK_LOWER") : invariant(false) : void 0;
    !(tickUpper <= TickMath.MAX_TICK && tickUpper % pool.tickSpacing === 0) ? process.env.NODE_ENV !== "production" ? invariant(false, "TICK_UPPER") : invariant(false) : void 0;
    this.pool = pool;
    this.tickLower = tickLower;
    this.tickUpper = tickUpper;
    this.liquidity = jsbi_default.BigInt(liquidity);
  }
  var _proto = Position2.prototype;
  _proto.ratiosAfterSlippage = function ratiosAfterSlippage(slippageTolerance) {
    var priceLower = this.pool.token0Price.asFraction.multiply(new Percent(1).subtract(slippageTolerance));
    var priceUpper = this.pool.token0Price.asFraction.multiply(slippageTolerance.add(1));
    var sqrtRatioX96Lower = encodeSqrtRatioX96(priceLower.numerator, priceLower.denominator);
    if (jsbi_default.lessThanOrEqual(sqrtRatioX96Lower, TickMath.MIN_SQRT_RATIO)) {
      sqrtRatioX96Lower = jsbi_default.add(TickMath.MIN_SQRT_RATIO, jsbi_default.BigInt(1));
    }
    var sqrtRatioX96Upper = encodeSqrtRatioX96(priceUpper.numerator, priceUpper.denominator);
    if (jsbi_default.greaterThanOrEqual(sqrtRatioX96Upper, TickMath.MAX_SQRT_RATIO)) {
      sqrtRatioX96Upper = jsbi_default.subtract(TickMath.MAX_SQRT_RATIO, jsbi_default.BigInt(1));
    }
    return {
      sqrtRatioX96Lower,
      sqrtRatioX96Upper
    };
  };
  _proto.mintAmountsWithSlippage = function mintAmountsWithSlippage(slippageTolerance) {
    var _this$ratiosAfterSlip = this.ratiosAfterSlippage(slippageTolerance), sqrtRatioX96Upper = _this$ratiosAfterSlip.sqrtRatioX96Upper, sqrtRatioX96Lower = _this$ratiosAfterSlip.sqrtRatioX96Lower;
    var poolLower = new Pool(this.pool.token0, this.pool.token1, this.pool.fee, sqrtRatioX96Lower, 0, TickMath.getTickAtSqrtRatio(sqrtRatioX96Lower));
    var poolUpper = new Pool(this.pool.token0, this.pool.token1, this.pool.fee, sqrtRatioX96Upper, 0, TickMath.getTickAtSqrtRatio(sqrtRatioX96Upper));
    var positionThatWillBeCreated = Position2.fromAmounts(_extends({
      pool: this.pool,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper
    }, this.mintAmounts, {
      useFullPrecision: false
    }));
    var amount0 = new Position2({
      pool: poolUpper,
      liquidity: positionThatWillBeCreated.liquidity,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper
    }).mintAmounts.amount0;
    var amount1 = new Position2({
      pool: poolLower,
      liquidity: positionThatWillBeCreated.liquidity,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper
    }).mintAmounts.amount1;
    return {
      amount0,
      amount1
    };
  };
  _proto.burnAmountsWithSlippage = function burnAmountsWithSlippage(slippageTolerance) {
    var _this$ratiosAfterSlip2 = this.ratiosAfterSlippage(slippageTolerance), sqrtRatioX96Upper = _this$ratiosAfterSlip2.sqrtRatioX96Upper, sqrtRatioX96Lower = _this$ratiosAfterSlip2.sqrtRatioX96Lower;
    var poolLower = new Pool(this.pool.token0, this.pool.token1, this.pool.fee, sqrtRatioX96Lower, 0, TickMath.getTickAtSqrtRatio(sqrtRatioX96Lower));
    var poolUpper = new Pool(this.pool.token0, this.pool.token1, this.pool.fee, sqrtRatioX96Upper, 0, TickMath.getTickAtSqrtRatio(sqrtRatioX96Upper));
    var amount0 = new Position2({
      pool: poolUpper,
      liquidity: this.liquidity,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper
    }).amount0;
    var amount1 = new Position2({
      pool: poolLower,
      liquidity: this.liquidity,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper
    }).amount1;
    return {
      amount0: amount0.quotient,
      amount1: amount1.quotient
    };
  };
  Position2.fromAmounts = function fromAmounts(_ref2) {
    var pool = _ref2.pool, tickLower = _ref2.tickLower, tickUpper = _ref2.tickUpper, amount0 = _ref2.amount0, amount1 = _ref2.amount1, useFullPrecision = _ref2.useFullPrecision;
    var sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower);
    var sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper);
    return new Position2({
      pool,
      tickLower,
      tickUpper,
      liquidity: maxLiquidityForAmounts(pool.sqrtRatioX96, sqrtRatioAX96, sqrtRatioBX96, amount0, amount1, useFullPrecision)
    });
  };
  Position2.fromAmount0 = function fromAmount0(_ref3) {
    var pool = _ref3.pool, tickLower = _ref3.tickLower, tickUpper = _ref3.tickUpper, amount0 = _ref3.amount0, useFullPrecision = _ref3.useFullPrecision;
    return Position2.fromAmounts({
      pool,
      tickLower,
      tickUpper,
      amount0,
      amount1: MaxUint2562,
      useFullPrecision
    });
  };
  Position2.fromAmount1 = function fromAmount1(_ref4) {
    var pool = _ref4.pool, tickLower = _ref4.tickLower, tickUpper = _ref4.tickUpper, amount1 = _ref4.amount1;
    return Position2.fromAmounts({
      pool,
      tickLower,
      tickUpper,
      amount0: MaxUint2562,
      amount1,
      useFullPrecision: true
    });
  };
  _createClass(Position2, [{
    key: "token0PriceLower",
    get: function get() {
      return tickToPrice(this.pool.token0, this.pool.token1, this.tickLower);
    }
    /**
     * Returns the price of token0 at the upper tick
     */
  }, {
    key: "token0PriceUpper",
    get: function get() {
      return tickToPrice(this.pool.token0, this.pool.token1, this.tickUpper);
    }
    /**
     * Returns the amount of token0 that this position's liquidity could be burned for at the current pool price
     */
  }, {
    key: "amount0",
    get: function get() {
      if (this._token0Amount === null) {
        if (this.pool.tickCurrent < this.tickLower) {
          this._token0Amount = CurrencyAmount.fromRawAmount(this.pool.token0, SqrtPriceMath.getAmount0Delta(TickMath.getSqrtRatioAtTick(this.tickLower), TickMath.getSqrtRatioAtTick(this.tickUpper), this.liquidity, false));
        } else if (this.pool.tickCurrent < this.tickUpper) {
          this._token0Amount = CurrencyAmount.fromRawAmount(this.pool.token0, SqrtPriceMath.getAmount0Delta(this.pool.sqrtRatioX96, TickMath.getSqrtRatioAtTick(this.tickUpper), this.liquidity, false));
        } else {
          this._token0Amount = CurrencyAmount.fromRawAmount(this.pool.token0, ZERO);
        }
      }
      return this._token0Amount;
    }
    /**
     * Returns the amount of token1 that this position's liquidity could be burned for at the current pool price
     */
  }, {
    key: "amount1",
    get: function get() {
      if (this._token1Amount === null) {
        if (this.pool.tickCurrent < this.tickLower) {
          this._token1Amount = CurrencyAmount.fromRawAmount(this.pool.token1, ZERO);
        } else if (this.pool.tickCurrent < this.tickUpper) {
          this._token1Amount = CurrencyAmount.fromRawAmount(this.pool.token1, SqrtPriceMath.getAmount1Delta(TickMath.getSqrtRatioAtTick(this.tickLower), this.pool.sqrtRatioX96, this.liquidity, false));
        } else {
          this._token1Amount = CurrencyAmount.fromRawAmount(this.pool.token1, SqrtPriceMath.getAmount1Delta(TickMath.getSqrtRatioAtTick(this.tickLower), TickMath.getSqrtRatioAtTick(this.tickUpper), this.liquidity, false));
        }
      }
      return this._token1Amount;
    }
  }, {
    key: "mintAmounts",
    get: function get() {
      if (this._mintAmounts === null) {
        if (this.pool.tickCurrent < this.tickLower) {
          return {
            amount0: SqrtPriceMath.getAmount0Delta(TickMath.getSqrtRatioAtTick(this.tickLower), TickMath.getSqrtRatioAtTick(this.tickUpper), this.liquidity, true),
            amount1: ZERO
          };
        } else if (this.pool.tickCurrent < this.tickUpper) {
          return {
            amount0: SqrtPriceMath.getAmount0Delta(this.pool.sqrtRatioX96, TickMath.getSqrtRatioAtTick(this.tickUpper), this.liquidity, true),
            amount1: SqrtPriceMath.getAmount1Delta(TickMath.getSqrtRatioAtTick(this.tickLower), this.pool.sqrtRatioX96, this.liquidity, true)
          };
        } else {
          return {
            amount0: ZERO,
            amount1: SqrtPriceMath.getAmount1Delta(TickMath.getSqrtRatioAtTick(this.tickLower), TickMath.getSqrtRatioAtTick(this.tickUpper), this.liquidity, true)
          };
        }
      }
      return this._mintAmounts;
    }
  }]);
  return Position2;
}();
var Multicall = /* @__PURE__ */ function() {
  function Multicall2() {
  }
  Multicall2.encodeMulticall = function encodeMulticall(calldatas) {
    if (!Array.isArray(calldatas)) {
      calldatas = [calldatas];
    }
    return calldatas.length === 1 ? calldatas[0] : Multicall2.INTERFACE.encodeFunctionData("multicall", [calldatas]);
  };
  Multicall2.decodeMulticall = function decodeMulticall(multicall) {
    return Multicall2.INTERFACE.decodeFunctionData("multicall", multicall).data;
  };
  return Multicall2;
}();
Multicall.INTERFACE = /* @__PURE__ */ new Interface(IMulticall_default.abi);
function isAllowedPermit(permitOptions) {
  return "nonce" in permitOptions;
}
var SelfPermit = /* @__PURE__ */ function() {
  function SelfPermit2() {
  }
  SelfPermit2.encodePermit = function encodePermit(token, options) {
    return isAllowedPermit(options) ? SelfPermit2.INTERFACE.encodeFunctionData("selfPermitAllowed", [token.address, toHex3(options.nonce), toHex3(options.expiry), options.v, options.r, options.s]) : SelfPermit2.INTERFACE.encodeFunctionData("selfPermit", [token.address, toHex3(options.amount), toHex3(options.deadline), options.v, options.r, options.s]);
  };
  return SelfPermit2;
}();
SelfPermit.INTERFACE = /* @__PURE__ */ new Interface(ISelfPermit_default.abi);
var Payments = /* @__PURE__ */ function() {
  function Payments2() {
  }
  Payments2.encodeFeeBips = function encodeFeeBips(fee) {
    return toHex3(fee.multiply(1e4).quotient);
  };
  Payments2.encodeUnwrapWETH9 = function encodeUnwrapWETH9(amountMinimum, recipient, feeOptions) {
    recipient = validateAndParseAddress(recipient);
    if (!!feeOptions) {
      var feeBips = this.encodeFeeBips(feeOptions.fee);
      var feeRecipient = validateAndParseAddress(feeOptions.recipient);
      return Payments2.INTERFACE.encodeFunctionData("unwrapWETH9WithFee", [toHex3(amountMinimum), recipient, feeBips, feeRecipient]);
    } else {
      return Payments2.INTERFACE.encodeFunctionData("unwrapWETH9", [toHex3(amountMinimum), recipient]);
    }
  };
  Payments2.encodeSweepToken = function encodeSweepToken(token, amountMinimum, recipient, feeOptions) {
    recipient = validateAndParseAddress(recipient);
    if (!!feeOptions) {
      var feeBips = this.encodeFeeBips(feeOptions.fee);
      var feeRecipient = validateAndParseAddress(feeOptions.recipient);
      return Payments2.INTERFACE.encodeFunctionData("sweepTokenWithFee", [token.address, toHex3(amountMinimum), recipient, feeBips, feeRecipient]);
    } else {
      return Payments2.INTERFACE.encodeFunctionData("sweepToken", [token.address, toHex3(amountMinimum), recipient]);
    }
  };
  Payments2.encodeRefundETH = function encodeRefundETH() {
    return Payments2.INTERFACE.encodeFunctionData("refundETH");
  };
  return Payments2;
}();
Payments.INTERFACE = /* @__PURE__ */ new Interface(IPeripheryPaymentsWithFee_default.abi);
var _excluded = ["expectedCurrencyOwed0", "expectedCurrencyOwed1"];
var MaxUint128 = /* @__PURE__ */ toHex3(/* @__PURE__ */ jsbi_default.subtract(/* @__PURE__ */ jsbi_default.exponentiate(/* @__PURE__ */ jsbi_default.BigInt(2), /* @__PURE__ */ jsbi_default.BigInt(128)), /* @__PURE__ */ jsbi_default.BigInt(1)));
function isMint(options) {
  return Object.keys(options).some(function(k) {
    return k === "recipient";
  });
}
var NFT_PERMIT_TYPES = {
  Permit: [{
    name: "spender",
    type: "address"
  }, {
    name: "tokenId",
    type: "uint256"
  }, {
    name: "nonce",
    type: "uint256"
  }, {
    name: "deadline",
    type: "uint256"
  }]
};
var NonfungiblePositionManager = /* @__PURE__ */ function() {
  function NonfungiblePositionManager2() {
  }
  NonfungiblePositionManager2.encodeCreate = function encodeCreate(pool) {
    return NonfungiblePositionManager2.INTERFACE.encodeFunctionData("createAndInitializePoolIfNecessary", [pool.token0.address, pool.token1.address, pool.fee, toHex3(pool.sqrtRatioX96)]);
  };
  NonfungiblePositionManager2.createCallParameters = function createCallParameters(pool) {
    return {
      calldata: this.encodeCreate(pool),
      value: toHex3(0)
    };
  };
  NonfungiblePositionManager2.addCallParameters = function addCallParameters(position, options) {
    !jsbi_default.greaterThan(position.liquidity, ZERO) ? process.env.NODE_ENV !== "production" ? invariant(false, "ZERO_LIQUIDITY") : invariant(false) : void 0;
    var calldatas = [];
    var _position$mintAmounts = position.mintAmounts, amount0Desired = _position$mintAmounts.amount0, amount1Desired = _position$mintAmounts.amount1;
    var minimumAmounts = position.mintAmountsWithSlippage(options.slippageTolerance);
    var amount0Min = toHex3(minimumAmounts.amount0);
    var amount1Min = toHex3(minimumAmounts.amount1);
    var deadline = toHex3(options.deadline);
    if (isMint(options) && options.createPool) {
      calldatas.push(this.encodeCreate(position.pool));
    }
    if (options.token0Permit) {
      calldatas.push(SelfPermit.encodePermit(position.pool.token0, options.token0Permit));
    }
    if (options.token1Permit) {
      calldatas.push(SelfPermit.encodePermit(position.pool.token1, options.token1Permit));
    }
    if (isMint(options)) {
      var recipient = validateAndParseAddress(options.recipient);
      calldatas.push(NonfungiblePositionManager2.INTERFACE.encodeFunctionData("mint", [{
        token0: position.pool.token0.address,
        token1: position.pool.token1.address,
        fee: position.pool.fee,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        amount0Desired: toHex3(amount0Desired),
        amount1Desired: toHex3(amount1Desired),
        amount0Min,
        amount1Min,
        recipient,
        deadline
      }]));
    } else {
      calldatas.push(NonfungiblePositionManager2.INTERFACE.encodeFunctionData("increaseLiquidity", [{
        tokenId: toHex3(options.tokenId),
        amount0Desired: toHex3(amount0Desired),
        amount1Desired: toHex3(amount1Desired),
        amount0Min,
        amount1Min,
        deadline
      }]));
    }
    var value = toHex3(0);
    if (options.useNative) {
      var wrapped = options.useNative.wrapped;
      !(position.pool.token0.equals(wrapped) || position.pool.token1.equals(wrapped)) ? process.env.NODE_ENV !== "production" ? invariant(false, "NO_WETH") : invariant(false) : void 0;
      var wrappedValue = position.pool.token0.equals(wrapped) ? amount0Desired : amount1Desired;
      if (jsbi_default.greaterThan(wrappedValue, ZERO)) {
        calldatas.push(Payments.encodeRefundETH());
      }
      value = toHex3(wrappedValue);
    }
    return {
      calldata: Multicall.encodeMulticall(calldatas),
      value
    };
  };
  NonfungiblePositionManager2.encodeCollect = function encodeCollect(options) {
    var calldatas = [];
    var tokenId = toHex3(options.tokenId);
    var involvesETH = options.expectedCurrencyOwed0.currency.isNative || options.expectedCurrencyOwed1.currency.isNative;
    var recipient = validateAndParseAddress(options.recipient);
    calldatas.push(NonfungiblePositionManager2.INTERFACE.encodeFunctionData("collect", [{
      tokenId,
      recipient: involvesETH ? ADDRESS_ZERO : recipient,
      amount0Max: MaxUint128,
      amount1Max: MaxUint128
    }]));
    if (involvesETH) {
      var ethAmount = options.expectedCurrencyOwed0.currency.isNative ? options.expectedCurrencyOwed0.quotient : options.expectedCurrencyOwed1.quotient;
      var token = options.expectedCurrencyOwed0.currency.isNative ? options.expectedCurrencyOwed1.currency : options.expectedCurrencyOwed0.currency;
      var tokenAmount = options.expectedCurrencyOwed0.currency.isNative ? options.expectedCurrencyOwed1.quotient : options.expectedCurrencyOwed0.quotient;
      calldatas.push(Payments.encodeUnwrapWETH9(ethAmount, recipient));
      calldatas.push(Payments.encodeSweepToken(token, tokenAmount, recipient));
    }
    return calldatas;
  };
  NonfungiblePositionManager2.collectCallParameters = function collectCallParameters(options) {
    var calldatas = NonfungiblePositionManager2.encodeCollect(options);
    return {
      calldata: Multicall.encodeMulticall(calldatas),
      value: toHex3(0)
    };
  };
  NonfungiblePositionManager2.removeCallParameters = function removeCallParameters(position, options) {
    var calldatas = [];
    var deadline = toHex3(options.deadline);
    var tokenId = toHex3(options.tokenId);
    var partialPosition = new Position({
      pool: position.pool,
      liquidity: options.liquidityPercentage.multiply(position.liquidity).quotient,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper
    });
    !jsbi_default.greaterThan(partialPosition.liquidity, ZERO) ? process.env.NODE_ENV !== "production" ? invariant(false, "ZERO_LIQUIDITY") : invariant(false) : void 0;
    var _partialPosition$burn = partialPosition.burnAmountsWithSlippage(options.slippageTolerance), amount0Min = _partialPosition$burn.amount0, amount1Min = _partialPosition$burn.amount1;
    if (options.permit) {
      calldatas.push(NonfungiblePositionManager2.INTERFACE.encodeFunctionData("permit", [validateAndParseAddress(options.permit.spender), tokenId, toHex3(options.permit.deadline), options.permit.v, options.permit.r, options.permit.s]));
    }
    calldatas.push(NonfungiblePositionManager2.INTERFACE.encodeFunctionData("decreaseLiquidity", [{
      tokenId,
      liquidity: toHex3(partialPosition.liquidity),
      amount0Min: toHex3(amount0Min),
      amount1Min: toHex3(amount1Min),
      deadline
    }]));
    var _options$collectOptio = options.collectOptions, expectedCurrencyOwed0 = _options$collectOptio.expectedCurrencyOwed0, expectedCurrencyOwed1 = _options$collectOptio.expectedCurrencyOwed1, rest = _objectWithoutPropertiesLoose(_options$collectOptio, _excluded);
    calldatas.push.apply(calldatas, NonfungiblePositionManager2.encodeCollect(_extends({
      tokenId: toHex3(options.tokenId),
      // add the underlying value to the expected currency already owed
      expectedCurrencyOwed0: expectedCurrencyOwed0.add(CurrencyAmount.fromRawAmount(expectedCurrencyOwed0.currency, amount0Min)),
      expectedCurrencyOwed1: expectedCurrencyOwed1.add(CurrencyAmount.fromRawAmount(expectedCurrencyOwed1.currency, amount1Min))
    }, rest)));
    if (options.liquidityPercentage.equalTo(ONE)) {
      if (options.burnToken) {
        calldatas.push(NonfungiblePositionManager2.INTERFACE.encodeFunctionData("burn", [tokenId]));
      }
    } else {
      !(options.burnToken !== true) ? process.env.NODE_ENV !== "production" ? invariant(false, "CANNOT_BURN") : invariant(false) : void 0;
    }
    return {
      calldata: Multicall.encodeMulticall(calldatas),
      value: toHex3(0)
    };
  };
  NonfungiblePositionManager2.safeTransferFromParameters = function safeTransferFromParameters(options) {
    var recipient = validateAndParseAddress(options.recipient);
    var sender = validateAndParseAddress(options.sender);
    var calldata;
    if (options.data) {
      calldata = NonfungiblePositionManager2.INTERFACE.encodeFunctionData("safeTransferFrom(address,address,uint256,bytes)", [sender, recipient, toHex3(options.tokenId), options.data]);
    } else {
      calldata = NonfungiblePositionManager2.INTERFACE.encodeFunctionData("safeTransferFrom(address,address,uint256)", [sender, recipient, toHex3(options.tokenId)]);
    }
    return {
      calldata,
      value: toHex3(0)
    };
  };
  NonfungiblePositionManager2.getPermitData = function getPermitData(permit, positionManagerAddress, chainId) {
    return {
      domain: {
        name: "Uniswap V3 Positions NFT-V1",
        chainId,
        version: "1",
        verifyingContract: positionManagerAddress
      },
      types: NFT_PERMIT_TYPES,
      values: permit
    };
  };
  return NonfungiblePositionManager2;
}();
NonfungiblePositionManager.INTERFACE = /* @__PURE__ */ new Interface(NonfungiblePositionManager_default.abi);
var SwapQuoter = /* @__PURE__ */ function() {
  function SwapQuoter2() {
  }
  SwapQuoter2.quoteCallParameters = function quoteCallParameters(route, amount, tradeType, options) {
    if (options === void 0) {
      options = {};
    }
    var singleHop = route.pools.length === 1;
    var quoteAmount = toHex3(amount.quotient);
    var calldata;
    var swapInterface = options.useQuoterV2 ? this.V2INTERFACE : this.V1INTERFACE;
    if (singleHop) {
      var _options$sqrtPriceLim, _options;
      var baseQuoteParams = {
        tokenIn: route.tokenPath[0].address,
        tokenOut: route.tokenPath[1].address,
        fee: route.pools[0].fee,
        sqrtPriceLimitX96: toHex3((_options$sqrtPriceLim = (_options = options) == null ? void 0 : _options.sqrtPriceLimitX96) != null ? _options$sqrtPriceLim : 0)
      };
      var v2QuoteParams = _extends({}, baseQuoteParams, tradeType === TradeType.EXACT_INPUT ? {
        amountIn: quoteAmount
      } : {
        amount: quoteAmount
      });
      var v1QuoteParams = [baseQuoteParams.tokenIn, baseQuoteParams.tokenOut, baseQuoteParams.fee, quoteAmount, baseQuoteParams.sqrtPriceLimitX96];
      var tradeTypeFunctionName = tradeType === TradeType.EXACT_INPUT ? "quoteExactInputSingle" : "quoteExactOutputSingle";
      calldata = swapInterface.encodeFunctionData(tradeTypeFunctionName, options.useQuoterV2 ? [v2QuoteParams] : v1QuoteParams);
    } else {
      var _options2;
      !(((_options2 = options) == null ? void 0 : _options2.sqrtPriceLimitX96) === void 0) ? process.env.NODE_ENV !== "production" ? invariant(false, "MULTIHOP_PRICE_LIMIT") : invariant(false) : void 0;
      var path = encodeRouteToPath(route, tradeType === TradeType.EXACT_OUTPUT);
      var _tradeTypeFunctionName = tradeType === TradeType.EXACT_INPUT ? "quoteExactInput" : "quoteExactOutput";
      calldata = swapInterface.encodeFunctionData(_tradeTypeFunctionName, [path, quoteAmount]);
    }
    return {
      calldata,
      value: toHex3(0)
    };
  };
  return SwapQuoter2;
}();
SwapQuoter.V1INTERFACE = /* @__PURE__ */ new Interface(Quoter_default.abi);
SwapQuoter.V2INTERFACE = /* @__PURE__ */ new Interface(QuoterV2_default.abi);
var Staker = /* @__PURE__ */ function() {
  function Staker2() {
  }
  Staker2.encodeClaim = function encodeClaim(incentiveKey, options) {
    var _options$amount;
    var calldatas = [];
    calldatas.push(Staker2.INTERFACE.encodeFunctionData("unstakeToken", [this._encodeIncentiveKey(incentiveKey), toHex3(options.tokenId)]));
    var recipient = validateAndParseAddress(options.recipient);
    var amount = (_options$amount = options.amount) != null ? _options$amount : 0;
    calldatas.push(Staker2.INTERFACE.encodeFunctionData("claimReward", [incentiveKey.rewardToken.address, recipient, toHex3(amount)]));
    return calldatas;
  };
  Staker2.collectRewards = function collectRewards(incentiveKeys, options) {
    incentiveKeys = Array.isArray(incentiveKeys) ? incentiveKeys : [incentiveKeys];
    var calldatas = [];
    for (var i = 0; i < incentiveKeys.length; i++) {
      var incentiveKey = incentiveKeys[i];
      calldatas = calldatas.concat(this.encodeClaim(incentiveKey, options));
      calldatas.push(Staker2.INTERFACE.encodeFunctionData("stakeToken", [this._encodeIncentiveKey(incentiveKey), toHex3(options.tokenId)]));
    }
    return {
      calldata: Multicall.encodeMulticall(calldatas),
      value: toHex3(0)
    };
  };
  Staker2.withdrawToken = function withdrawToken(incentiveKeys, withdrawOptions) {
    var calldatas = [];
    incentiveKeys = Array.isArray(incentiveKeys) ? incentiveKeys : [incentiveKeys];
    var claimOptions = {
      tokenId: withdrawOptions.tokenId,
      recipient: withdrawOptions.recipient,
      amount: withdrawOptions.amount
    };
    for (var i = 0; i < incentiveKeys.length; i++) {
      var incentiveKey = incentiveKeys[i];
      calldatas = calldatas.concat(this.encodeClaim(incentiveKey, claimOptions));
    }
    var owner = validateAndParseAddress(withdrawOptions.owner);
    calldatas.push(Staker2.INTERFACE.encodeFunctionData("withdrawToken", [toHex3(withdrawOptions.tokenId), owner, withdrawOptions.data ? withdrawOptions.data : toHex3(0)]));
    return {
      calldata: Multicall.encodeMulticall(calldatas),
      value: toHex3(0)
    };
  };
  Staker2.encodeDeposit = function encodeDeposit(incentiveKeys) {
    incentiveKeys = Array.isArray(incentiveKeys) ? incentiveKeys : [incentiveKeys];
    var data;
    if (incentiveKeys.length > 1) {
      var keys = [];
      for (var i = 0; i < incentiveKeys.length; i++) {
        var incentiveKey = incentiveKeys[i];
        keys.push(this._encodeIncentiveKey(incentiveKey));
      }
      data = defaultAbiCoder.encode([Staker2.INCENTIVE_KEY_ABI + "[]"], [keys]);
    } else {
      data = defaultAbiCoder.encode([Staker2.INCENTIVE_KEY_ABI], [this._encodeIncentiveKey(incentiveKeys[0])]);
    }
    return data;
  };
  Staker2._encodeIncentiveKey = function _encodeIncentiveKey(incentiveKey) {
    var _incentiveKey$pool = incentiveKey.pool, token0 = _incentiveKey$pool.token0, token1 = _incentiveKey$pool.token1, fee = _incentiveKey$pool.fee;
    var refundee = validateAndParseAddress(incentiveKey.refundee);
    return {
      rewardToken: incentiveKey.rewardToken.address,
      pool: Pool.getAddress(token0, token1, fee),
      startTime: toHex3(incentiveKey.startTime),
      endTime: toHex3(incentiveKey.endTime),
      refundee
    };
  };
  return Staker2;
}();
Staker.INTERFACE = /* @__PURE__ */ new Interface(UniswapV3Staker_default.abi);
Staker.INCENTIVE_KEY_ABI = "tuple(address rewardToken, address pool, uint256 startTime, uint256 endTime, address refundee)";
var SwapRouter = /* @__PURE__ */ function() {
  function SwapRouter2() {
  }
  SwapRouter2.swapCallParameters = function swapCallParameters(trades, options) {
    if (!Array.isArray(trades)) {
      trades = [trades];
    }
    var sampleTrade = trades[0];
    var tokenIn = sampleTrade.inputAmount.currency.wrapped;
    var tokenOut = sampleTrade.outputAmount.currency.wrapped;
    !trades.every(function(trade2) {
      return trade2.inputAmount.currency.wrapped.equals(tokenIn);
    }) ? process.env.NODE_ENV !== "production" ? invariant(false, "TOKEN_IN_DIFF") : invariant(false) : void 0;
    !trades.every(function(trade2) {
      return trade2.outputAmount.currency.wrapped.equals(tokenOut);
    }) ? process.env.NODE_ENV !== "production" ? invariant(false, "TOKEN_OUT_DIFF") : invariant(false) : void 0;
    var calldatas = [];
    var ZERO_IN = CurrencyAmount.fromRawAmount(trades[0].inputAmount.currency, 0);
    var ZERO_OUT = CurrencyAmount.fromRawAmount(trades[0].outputAmount.currency, 0);
    var totalAmountOut = trades.reduce(function(sum, trade2) {
      return sum.add(trade2.minimumAmountOut(options.slippageTolerance));
    }, ZERO_OUT);
    var mustRefund = sampleTrade.inputAmount.currency.isNative && sampleTrade.tradeType === TradeType.EXACT_OUTPUT;
    var inputIsNative = sampleTrade.inputAmount.currency.isNative;
    var outputIsNative = sampleTrade.outputAmount.currency.isNative;
    var routerMustCustody = outputIsNative || !!options.fee;
    var totalValue = inputIsNative ? trades.reduce(function(sum, trade2) {
      return sum.add(trade2.maximumAmountIn(options.slippageTolerance));
    }, ZERO_IN) : ZERO_IN;
    if (options.inputTokenPermit) {
      !sampleTrade.inputAmount.currency.isToken ? process.env.NODE_ENV !== "production" ? invariant(false, "NON_TOKEN_PERMIT") : invariant(false) : void 0;
      calldatas.push(SelfPermit.encodePermit(sampleTrade.inputAmount.currency, options.inputTokenPermit));
    }
    var recipient = validateAndParseAddress(options.recipient);
    var deadline = toHex3(options.deadline);
    for (var _iterator = _createForOfIteratorHelperLoose(trades), _step; !(_step = _iterator()).done; ) {
      var trade = _step.value;
      for (var _iterator2 = _createForOfIteratorHelperLoose(trade.swaps), _step2; !(_step2 = _iterator2()).done; ) {
        var _step2$value = _step2.value, route = _step2$value.route, inputAmount = _step2$value.inputAmount, outputAmount = _step2$value.outputAmount;
        var amountIn = toHex3(trade.maximumAmountIn(options.slippageTolerance, inputAmount).quotient);
        var amountOut = toHex3(trade.minimumAmountOut(options.slippageTolerance, outputAmount).quotient);
        var singleHop = route.pools.length === 1;
        if (singleHop) {
          if (trade.tradeType === TradeType.EXACT_INPUT) {
            var _options$sqrtPriceLim;
            var exactInputSingleParams = {
              tokenIn: route.tokenPath[0].address,
              tokenOut: route.tokenPath[1].address,
              fee: route.pools[0].fee,
              recipient: routerMustCustody ? ADDRESS_ZERO : recipient,
              deadline,
              amountIn,
              amountOutMinimum: amountOut,
              sqrtPriceLimitX96: toHex3((_options$sqrtPriceLim = options.sqrtPriceLimitX96) != null ? _options$sqrtPriceLim : 0)
            };
            calldatas.push(SwapRouter2.INTERFACE.encodeFunctionData("exactInputSingle", [exactInputSingleParams]));
          } else {
            var _options$sqrtPriceLim2;
            var exactOutputSingleParams = {
              tokenIn: route.tokenPath[0].address,
              tokenOut: route.tokenPath[1].address,
              fee: route.pools[0].fee,
              recipient: routerMustCustody ? ADDRESS_ZERO : recipient,
              deadline,
              amountOut,
              amountInMaximum: amountIn,
              sqrtPriceLimitX96: toHex3((_options$sqrtPriceLim2 = options.sqrtPriceLimitX96) != null ? _options$sqrtPriceLim2 : 0)
            };
            calldatas.push(SwapRouter2.INTERFACE.encodeFunctionData("exactOutputSingle", [exactOutputSingleParams]));
          }
        } else {
          !(options.sqrtPriceLimitX96 === void 0) ? process.env.NODE_ENV !== "production" ? invariant(false, "MULTIHOP_PRICE_LIMIT") : invariant(false) : void 0;
          var path = encodeRouteToPath(route, trade.tradeType === TradeType.EXACT_OUTPUT);
          if (trade.tradeType === TradeType.EXACT_INPUT) {
            var exactInputParams = {
              path,
              recipient: routerMustCustody ? ADDRESS_ZERO : recipient,
              deadline,
              amountIn,
              amountOutMinimum: amountOut
            };
            calldatas.push(SwapRouter2.INTERFACE.encodeFunctionData("exactInput", [exactInputParams]));
          } else {
            var exactOutputParams = {
              path,
              recipient: routerMustCustody ? ADDRESS_ZERO : recipient,
              deadline,
              amountOut,
              amountInMaximum: amountIn
            };
            calldatas.push(SwapRouter2.INTERFACE.encodeFunctionData("exactOutput", [exactOutputParams]));
          }
        }
      }
    }
    if (routerMustCustody) {
      if (!!options.fee) {
        if (outputIsNative) {
          calldatas.push(Payments.encodeUnwrapWETH9(totalAmountOut.quotient, recipient, options.fee));
        } else {
          calldatas.push(Payments.encodeSweepToken(sampleTrade.outputAmount.currency.wrapped, totalAmountOut.quotient, recipient, options.fee));
        }
      } else {
        calldatas.push(Payments.encodeUnwrapWETH9(totalAmountOut.quotient, recipient));
      }
    }
    if (mustRefund) {
      calldatas.push(Payments.encodeRefundETH());
    }
    return {
      calldata: Multicall.encodeMulticall(calldatas),
      value: toHex3(totalValue.quotient)
    };
  };
  return SwapRouter2;
}();
SwapRouter.INTERFACE = /* @__PURE__ */ new Interface(SwapRouter_default.abi);

// src/entities/factory/utils/configBuilder.ts
import { sortsBefore } from "@uniswap/v4-sdk";
function buildConfig(params, addresses) {
  validateBasicParams(params);
  const { startTick, endTick } = computeTicks(
    params.priceRange,
    params.tickSpacing
  );
  const gamma = computeOptimalGamma(
    startTick,
    endTick,
    params.duration,
    params.epochLength,
    params.tickSpacing
  );
  const startTime = params.blockTimestamp + params.startTimeOffset * DAY_SECONDS;
  const endTime = params.blockTimestamp + params.duration * DAY_SECONDS;
  const totalDuration = endTime - startTime;
  if (totalDuration % params.epochLength !== 0) {
    throw new Error("Epoch length must divide total duration evenly");
  }
  if (gamma % params.tickSpacing !== 0) {
    throw new Error("Computed gamma must be divisible by tick spacing");
  }
  const {
    tokenFactory,
    dopplerDeployer,
    v4Initializer,
    poolManager,
    airlock,
    migrator
  } = addresses;
  const tokenParams = {
    name: params.name,
    symbol: params.symbol,
    initialSupply: params.totalSupply,
    airlock,
    yearlyMintCap: 0n,
    vestingDuration: 0n,
    recipients: [],
    amounts: []
  };
  const initialPrice = BigInt(
    TickMath.getSqrtRatioAtTick(startTick).toString()
  );
  console.log("startTick", startTick);
  console.log("initialPrice", initialPrice);
  const dopplerParams = {
    initialPrice,
    minimumProceeds: params.minProceeds,
    maximumProceeds: params.maxProceeds,
    startingTime: BigInt(startTime),
    endingTime: BigInt(endTime),
    startingTick: startTick,
    endingTick: endTick,
    epochLength: BigInt(params.epochLength),
    gamma,
    isToken0: false,
    numPDSlugs: BigInt(params.numPdSlugs ?? DEFAULT_PD_SLUGS)
  };
  const mineParams = {
    airlock,
    poolManager,
    deployer: dopplerDeployer,
    initialSupply: params.totalSupply,
    numTokensToSell: params.numTokensToSell,
    numeraire: ETH_ADDRESS,
    tokenFactory,
    tokenFactoryData: tokenParams,
    poolInitializer: v4Initializer,
    poolInitializerData: dopplerParams
  };
  const [salt, , , poolInitializerData, tokenFactoryData] = mine(mineParams);
  const governanceFactoryData = encodeAbiParameters(
    [{ type: "string" }],
    [params.name]
  );
  const createArgs = {
    initialSupply: params.totalSupply,
    numTokensToSell: params.numTokensToSell,
    numeraire: ETH_ADDRESS,
    tokenFactory,
    tokenFactoryData,
    governanceFactory: addresses.governanceFactory,
    governanceFactoryData,
    poolInitializer: v4Initializer,
    poolInitializerData,
    liquidityMigrator: migrator,
    liquidityMigratorData: toHex(""),
    integrator: "0xcD3365F82eDD9750C2Fb287309eD7539cBFB51a9",
    salt
  };
  return createArgs;
}
function computeTicks(priceRange, tickSpacing) {
  const quoteToken = new Token(1, ETH_ADDRESS, 18);
  const assetToken = new Token(
    1,
    "0x0000000000000000000000000000000000000001",
    18
  );
  let startTick = priceToClosestTick(
    new Price2(
      assetToken,
      quoteToken,
      parseEther("1").toString(),
      parseEther(priceRange.startPrice.toString()).toString()
    )
  );
  let endTick = priceToClosestTick(
    new Price2(
      assetToken,
      quoteToken,
      parseEther("1").toString(),
      parseEther(priceRange.endPrice.toString()).toString()
    )
  );
  startTick = Math.floor(startTick / tickSpacing) * tickSpacing;
  endTick = Math.floor(endTick / tickSpacing) * tickSpacing;
  if (startTick === endTick) {
    throw new Error("Start and end prices must result in different ticks");
  }
  return { startTick, endTick };
}
function computeOptimalGamma(startTick, endTick, durationDays, epochLength, tickSpacing) {
  const totalEpochs = durationDays * DAY_SECONDS / epochLength;
  const tickDelta = Math.abs(endTick - startTick);
  let gamma = Math.ceil(tickDelta / totalEpochs) * tickSpacing;
  gamma = Math.max(tickSpacing, gamma);
  if (gamma % tickSpacing !== 0) {
    throw new Error("Computed gamma must be divisible by tick spacing");
  }
  return gamma;
}
function validateBasicParams(params) {
  if (params.tickSpacing > MAX_TICK_SPACING) {
    throw new Error(`Tick spacing cannot exceed ${MAX_TICK_SPACING}`);
  }
  if (params.startTimeOffset < 0) {
    throw new Error("Start time offset must be positive");
  }
  if (params.duration <= 0) {
    throw new Error("Duration must be positive");
  }
  if (params.epochLength <= 0) {
    throw new Error("Epoch length must be positive");
  }
  if (params.maxProceeds < params.minProceeds) {
    throw new Error("Maximum proceeds must be greater than minimum proceeds");
  }
  if (params.priceRange.startPrice === 0 || params.priceRange.endPrice === 0) {
    throw new Error("Prices must be positive");
  }
  if (params.priceRange.startPrice === params.priceRange.endPrice) {
    throw new Error("Start and end prices must be different");
  }
}
function priceToClosestTick(price) {
  const sorted = sortsBefore(price.baseCurrency, price.quoteCurrency);
  const sqrtRatioX96 = sorted ? encodeSqrtRatioX96(price.numerator, price.denominator) : encodeSqrtRatioX96(price.denominator, price.numerator);
  let tick = TickMath.getTickAtSqrtRatio(sqrtRatioX96);
  const nextTickPrice = tickToPrice(
    price.baseCurrency,
    price.quoteCurrency,
    tick + 1
  );
  if (sorted) {
    if (!price.lessThan(nextTickPrice)) {
      tick++;
    }
  } else {
    if (!price.greaterThan(nextTickPrice)) {
      tick++;
    }
  }
  return tick;
}

// src/entities/factory/utils/airlockMiner.ts
var FLAG_MASK = BigInt(16383);
var flags = BigInt(
  1 << 13 | // BEFORE_INITIALIZE_FLAG
  1 << 12 | // AFTER_INITIALIZE_FLAG
  1 << 11 | // BEFORE_ADD_LIQUIDITY_FLAG
  1 << 7 | // BEFORE_SWAP_FLAG
  1 << 6 | // AFTER_SWAP_FLAG
  1 << 5
  // BEFORE_DONATE_FLAG
);
function computeCreate2Address(salt, initCodeHash, deployer) {
  const encoded = encodePacked(
    ["bytes1", "address", "bytes32", "bytes32"],
    ["0xff", deployer, salt, initCodeHash]
  );
  return getAddress(`0x${keccak256(encoded).slice(-40)}`);
}
function mine(params) {
  const isToken0 = params.numeraire !== "0x0000000000000000000000000000000000000000";
  const {
    initialPrice,
    minimumProceeds,
    maximumProceeds,
    startingTime,
    endingTime,
    startingTick,
    endingTick,
    epochLength,
    gamma,
    numPDSlugs
  } = params.poolInitializerData;
  const poolInitializerData = encodeAbiParameters(
    [
      { type: "uint160" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "int24" },
      { type: "int24" },
      { type: "uint256" },
      { type: "int24" },
      { type: "bool" },
      { type: "uint256" }
    ],
    [
      initialPrice,
      minimumProceeds,
      maximumProceeds,
      startingTime,
      endingTime,
      startingTick,
      endingTick,
      epochLength,
      gamma,
      isToken0,
      numPDSlugs
    ]
  );
  const hookInitHashData = encodeAbiParameters(
    [
      { type: "address" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "int24" },
      { type: "int24" },
      { type: "uint256" },
      { type: "int24" },
      { type: "bool" },
      { type: "uint256" },
      { type: "address" }
    ],
    [
      params.poolManager,
      params.numTokensToSell,
      minimumProceeds,
      maximumProceeds,
      startingTime,
      endingTime,
      startingTick,
      endingTick,
      epochLength,
      gamma,
      isToken0,
      numPDSlugs,
      params.poolInitializer
    ]
  );
  const hookInitHash = keccak256(
    encodePacked(["bytes", "bytes"], [DopplerBytecode, hookInitHashData])
  );
  const { name, symbol, yearlyMintCap, vestingDuration, recipients, amounts } = params.tokenFactoryData;
  const tokenFactoryData = encodeAbiParameters(
    [
      { type: "string" },
      { type: "string" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "address[]" },
      { type: "uint256[]" }
    ],
    [name, symbol, yearlyMintCap, vestingDuration, recipients, amounts]
  );
  const initHashData = encodeAbiParameters(
    [
      { type: "string" },
      { type: "string" },
      { type: "uint256" },
      { type: "address" },
      { type: "address" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "address[]" },
      { type: "uint256[]" }
    ],
    [
      name,
      symbol,
      params.initialSupply,
      params.airlock,
      params.airlock,
      yearlyMintCap,
      vestingDuration,
      recipients,
      amounts
    ]
  );
  const tokenInitHash = keccak256(
    encodePacked(["bytes", "bytes"], [DERC20Bytecode, initHashData])
  );
  for (let salt = BigInt(0); salt < BigInt(1e6); salt++) {
    const saltBytes = `0x${salt.toString(16).padStart(64, "0")}`;
    const hook = computeCreate2Address(
      saltBytes,
      hookInitHash,
      params.deployer
    );
    const token = computeCreate2Address(
      saltBytes,
      tokenInitHash,
      params.tokenFactory
    );
    const hookBigInt = BigInt(hook);
    const tokenBigInt = BigInt(token);
    const numeraireBigInt = BigInt(params.numeraire);
    if ((hookBigInt & FLAG_MASK) === flags && (isToken0 && tokenBigInt < numeraireBigInt || !isToken0 && tokenBigInt > numeraireBigInt)) {
      console.log("found salt", salt);
      console.log("hook", hook);
      console.log("token", token);
      return [saltBytes, hook, token, poolInitializerData, tokenFactoryData];
    }
  }
  throw new Error("AirlockMiner: could not find salt");
}

// src/entities/router/ReadWriteRouter.ts
import { Drift as Drift5 } from "@delvtech/drift";
var ReadWriteRouter = class {
  constructor(address, drift = new Drift5()) {
    this.contract = drift.contract({
      abi: customRouterAbi,
      address
    });
  }
  async buyExactIn(params) {
    return this.contract.write("buyExactIn", params);
  }
  async buyExactOut(params) {
    return this.contract.write("buyExactOut", params);
  }
  async sellExactIn(params) {
    return this.contract.write("sellExactIn", params);
  }
  async sellExactOut(params) {
    return this.contract.write("sellExactOut", params);
  }
};

// src/entities/token/derc20/ReadWriteDerc20.ts
import { Drift as Drift6 } from "@delvtech/drift";
var ReadWriteDerc20 = class extends ReadDerc20 {
  constructor(address, drift = new Drift6()) {
    super(address, drift);
  }
  async approve(spender, value) {
    return this.contract.write(
      "approve",
      { spender, value },
      {
        onMined: () => {
          this.contract.invalidateReadsMatching("allowance");
        }
      }
    );
  }
};

// src/addresses.ts
var DOPPLER_V4_ADDRESSES = {
  // unichain sepolia
  1301: {
    poolManager: "0xC81462Fec8B23319F288047f8A03A57682a35C1A",
    airlock: "0x3d067F7091c9743De932CcD808Ee3D01C51F881F",
    tokenFactory: "0x8993Cbb0b951ca1472DC09112B9a726aC088b50f",
    dopplerDeployer: "0xDf5273653c0e9799226d6a2D890d79754A4D36AB",
    v4Initializer: "0x8aB8D2d0648Bf1DFeD438540F46eaD7542820BeB",
    v3Initializer: "0x5Cf5D175bC74319d4AF42f3026aF6446901559a7",
    governanceFactory: "0xD7Bd7A6C5847536486C262c9a47C2903ec41d978",
    migrator: "0x106dA038525f8D5DA14e8E9094CF2235221659fB",
    stateView: "0xdE04C804dc75E90D8a64e5589092a1D6692EFA45",
    quoter: "0xfe6Cf50c4cfe801dd2AEf9c1B3ce24f551944df8",
    customRouter: "0x41B9bd894A2e2C0B10832E5Af0f9cEafe444fc0e",
    uniRouter: "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C"
  }
};
export {
  DAY_SECONDS,
  DEFAULT_PD_SLUGS,
  DOPPLER_V4_ADDRESSES,
  ETH_ADDRESS,
  MAX_TICK_SPACING,
  ModuleState,
  ReadDerc20,
  ReadDoppler,
  ReadEth,
  ReadFactory,
  ReadWriteDerc20,
  ReadWriteFactory,
  ReadWriteRouter,
  buildConfig,
  mine,
  priceToClosestTick
};
/*! Bundled license information:

js-sha3/src/sha3.js:
  (**
   * [js-sha3]{@link https://github.com/emn178/js-sha3}
   *
   * @version 0.8.0
   * @author Chen, Yi-Cyuan [emn178@gmail.com]
   * @copyright Chen, Yi-Cyuan 2015-2018
   * @license MIT
   *)
*/
