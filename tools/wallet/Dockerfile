# Dev tool only: the GNU Taler wallet CLI as an external program, used by the
# end-to-end proof. Nothing from it is vendored or linked into arvuna.
#
# The apt repository's signing key (taler.net/taler-systems.gpg.key) expired
# on 2025-01-10, so apt refuses the repo. This image instead downloads the
# .deb over TLS from deb.taler.net and checks its SHA-256 against the
# repository's Packages index. That is weaker than a signature check.
FROM debian:trixie-slim
ARG ARCH=arm64
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gzip \
 && curl -fsS https://deb.taler.net/apt/debian/dists/trixie/main/binary-$ARCH/Packages.gz | gunzip > /tmp/Packages \
 && awk -v RS= '/^Package: taler-wallet-cli\n/ && !n++' /tmp/Packages > /tmp/stanza \
 && cat /tmp/stanza | grep -E '^(Package|Version|Filename|SHA256|Depends):' \
 && FILE=$(sed -n 's/^Filename: //p' /tmp/stanza) && SUM=$(sed -n 's/^SHA256: //p' /tmp/stanza) \
 && curl -fsS -o /tmp/w.deb https://deb.taler.net/apt/debian/$FILE \
 && echo "$SUM  /tmp/w.deb" | sha256sum -c - \
 && apt-get install -y --no-install-recommends /tmp/w.deb \
 && rm -rf /var/lib/apt/lists/* /tmp/*
ENTRYPOINT ["taler-wallet-cli"]
