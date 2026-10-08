#!/bin/bash
# Operator-only installation. This script is not invoked by GitHub Actions.
set -euo pipefail

if [[ $EUID != 0 || $# != 2 || "$2" != --approved ]]; then
  echo "Usage: sudo bash install.sh /private/path/deploy-key.pub --approved" >&2
  exit 1
fi
key_file=$1
scripts=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[[ -f "$key_file" && ! -L "$key_file" ]]
[[ $(wc -l < "$key_file") == 1 ]]
read -r key_type key_value key_comment < "$key_file"
[[ "$key_type" == ssh-ed25519 && "$key_value" =~ ^[A-Za-z0-9+/]+={0,2}$ ]]
[[ -L /opt/sirfbazar-api/current ]]
[[ $(dirname -- "$(readlink -f /opt/sirfbazar-api/current)") == /opt/sirfbazar-api/releases ]]
systemctl is-active --quiet sirfbazar-api.service
id sirfbazar-api > /dev/null
python3 -c 'import tarfile; assert hasattr(tarfile, "data_filter")'
[[ $(node -p 'process.versions.node.split(".")[0]') == 22 ]]
if id sirfbazar-deploy > /dev/null 2>&1 || [[ -e /etc/sudoers.d/sirfbazar-deploy || -e /usr/local/libexec/sirfbazar-deploy || -e /var/lib/sirfbazar-deploy ]]; then
  echo "Deployment account or helper already exists; inspect it manually instead of overwriting." >&2
  exit 1
fi
for script in archive.py ssh-command.py promote.py healthcheck.cjs; do
  [[ -f "$scripts/$script" && ! -L "$scripts/$script" ]]
done
sudo_rule=$(mktemp)
trap 'rm -f -- "$sudo_rule"' EXIT
printf '%s\n' 'sirfbazar-deploy ALL=(root) NOPASSWD: /usr/local/libexec/sirfbazar-deploy/promote.py *' > "$sudo_rule"
# Validate syntax before creating an account; every helper argument is revalidated.
visudo -cf "$sudo_rule"
useradd --system --user-group --no-create-home --home-dir /var/lib/sirfbazar-deploy --shell /bin/sh sirfbazar-deploy
passwd -l sirfbazar-deploy > /dev/null
install -d -o root -g root -m 0755 /var/lib/sirfbazar-deploy /var/lib/sirfbazar-deploy/.ssh /usr/local/libexec/sirfbazar-deploy
install -d -o root -g sirfbazar-deploy -m 1730 /var/lib/sirfbazar-deploy/incoming
for script in archive.py ssh-command.py promote.py healthcheck.cjs; do
  install -o root -g root -m 0755 "$scripts/$script" "/usr/local/libexec/sirfbazar-deploy/$script"
done
printf 'restrict,command="/usr/local/libexec/sirfbazar-deploy/ssh-command.py" %s %s\n' "$key_type" "$key_value" > /var/lib/sirfbazar-deploy/.ssh/authorized_keys
chown root:root /var/lib/sirfbazar-deploy/.ssh/authorized_keys
chmod 0644 /var/lib/sirfbazar-deploy/.ssh/authorized_keys
install -o root -g root -m 0440 "$sudo_rule" /etc/sudoers.d/sirfbazar-deploy
visudo -cf /etc/sudoers.d/sirfbazar-deploy
echo 'Restricted deployment helpers installed. GitHub activation is a separate approved step.'
