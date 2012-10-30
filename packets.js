var packets =
{ header: '\
    b8( \
      &0x80/1:  \
        b16{b1 => control, b15 => type}, x16{0} \
      , -b32 => additional \
      , -b32 => timestamp \
      , -b32 => destination \
      | \
        b32{b1 => control, b31 => sequence} \
      , b32{b2 => position, b1 => inOrder, b29 => number} \
      , -b32 => timestamp \
      , -b32 => destination \
      ) \
    '
, handshake: '\
    -b32 => version \
  , -b32 => socketType \
  , -b32 => sequence \
  , -b32 => maxPacketSize \
  , -b32 => windowSize \
  , -b32 => connectionType \
  , -b32 => socketId \
  , b32 => synCookie \
  , b32 => address \
  , x96{0} \
  '
}

module.exports = packets;
