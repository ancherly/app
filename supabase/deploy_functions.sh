#!/bin/bash
# ================================================================
# GYMFICHAJE — Deploy Edge Functions a Supabase
# ================================================================
# Uso: bash /app/supabase/deploy_functions.sh TU_ACCESS_TOKEN
# 
# El Access Token se obtiene en:
#   https://supabase.com/dashboard/account/tokens → "Generate new token"
#
# Diferencia con las claves del proyecto:
#   - anon key / service_role → claves del PROYECTO (ya las tienes)
#   - Access Token → clave de tu CUENTA Supabase (necesaria para el CLI)
# ================================================================

set -e

ACCESS_TOKEN="${1:-$SUPABASE_ACCESS_TOKEN}"
PROJECT_REF="urmdglvrqnhzlhtprfuc"

if [ -z "$ACCESS_TOKEN" ]; then
  echo "ERROR: Necesitas proporcionar tu Supabase Access Token."
  echo "Uso: bash deploy_functions.sh TU_TOKEN"
  echo "Obtener token: https://supabase.com/dashboard/account/tokens"
  exit 1
fi

echo "Configurando Supabase CLI..."
export SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN"

echo "Enlazando proyecto $PROJECT_REF..."
supabase link --project-ref "$PROJECT_REF"

echo "Desplegando función create-user..."
supabase functions deploy create-user --project-ref "$PROJECT_REF"

echo "Desplegando función reset-user-password..."
supabase functions deploy reset-user-password --project-ref "$PROJECT_REF"

echo ""
echo "Funciones desplegadas correctamente."
echo "Verifica en: https://supabase.com/dashboard/project/$PROJECT_REF/functions"
